import React, { useState, useMemo, useEffect, useCallback } from "react";
import styles from "./header.module.css";
import { Button, Selector } from "../Core";
import { notifier } from "../Core/Notification";
import { AppState } from "../../reducers/rootReducer";
import { useSelector, useDispatch } from "react-redux";
import fs from "fs";
import promiseIpc from "electron-promise-ipc";
import path from "path";
import { BUILD_IN_RULE, setCurrentRule } from "../../reducers/settingReducer";
import {
  ProxyState,
  setIsProcessing,
  startVpn,
  stopVpn
} from "../../reducers/proxyReducer";

import { ipcRenderer } from "electron";
import { getActivatedServer } from "../Proxies/util";
import { Config } from "../../../electron/main";
import { DNS_OPTIONS, DNS_SMART_TYPE } from "../../constants";
import { Dns } from "../../../electron/process_manager";
import detectPort from "detect-port";

const Header = () => {
  const customizedRulesDirPath = useSelector<AppState, string>(
    state => state.setting.rule.dirPath
  );
  const localPort = useSelector<AppState, number>(
    state => state.setting.general.shadowsocksLocalPort
  );
  const isStarted = useSelector<AppState, boolean>(
    state => state.proxy.isStarted
  );
  const isProcessing = useSelector<AppState, boolean>(
    state => state.proxy.isProcessing
  );
  const additionalRoute = useSelector<
    AppState,
    { proxy: string[]; reserved: string[] }
  >(state => {
    const proxy: string[] = [],
      reserved: string[] = [];
    const additionalRoutes = state.setting.rule.additionRoutes;
    additionalRoutes.forEach(route => {
      if (route.isProxy) proxy.push(route.ip);
      else reserved.push(route.ip);
    });

    return { proxy, reserved };
  });
  const proxy = useSelector<AppState, ProxyState>(state => state.proxy);
  //@ts-ignore
  const dns = useSelector<AppState, Dns>(state => {
    const dnsSetting = state.setting.dns;
    if (dnsSetting.type === DNS_SMART_TYPE) {
      const defaultWebsiteDns = DNS_OPTIONS.find(
        option => option.name === dnsSetting.smart.defaultWebsite.name
      );
      const nativeWebsiteDns = DNS_OPTIONS.find(
        option => option.name === dnsSetting.smart.nativeWebsite.name
      );
      return {
        type: dnsSetting.type,
        defaultWebsite: {
          isProxy: dnsSetting.smart.defaultWebsite.isProxy,
          ...defaultWebsiteDns
        },
        nativeWebsite: {
          isProxy: dnsSetting.smart.nativeWebsite.isProxy,
          ...nativeWebsiteDns
        }
      };
    } else
      return {
        type: dnsSetting.type,
        ...dnsSetting.customized
      };
  });
  const activeId = useSelector<AppState, string>(state => state.proxy.activeId);
  const currentRule = useSelector<AppState, string>(
    state => state.setting.rule.current
  );
  const [rulePaths, setRulePaths] = useState<string[]>([]);
  const [isLoadingRules, setIsLoadingRules] = useState(false);
  const dispatch = useDispatch();
  const changeCurrentRule = useCallback(
    (rule: string) => dispatch(setCurrentRule(rule)),
    [dispatch]
  );

  const start = useCallback(async () => {
    try {
      if (!activeId) {
        notifier.error("No server has been selected!");
        return;
      }
      dispatch(setIsProcessing(true));
      const activatedServer = getActivatedServer(proxy);
      const rulePath = rulePaths.find(
        rulePath => path.basename(rulePath, ".rules") === currentRule
      ) as string;
      if (activatedServer.type === "shadowsocks") {
        const _port = await detectPort(localPort);
        if (_port !== localPort)
          throw new Error(
            `port: ${localPort} was occupied, try port: ${_port}`
          );
      }
      const config: Config = {
        rulePath,
        dns,
        additionalRoute: additionalRoute,
        // @ts-ignore
        server:
          activatedServer.type === "shadowsocks"
            ? { ...activatedServer, proxyPort: localPort }
            : activatedServer
      };
      // @ts-ignore
      await promiseIpc.send("start", config);
      dispatch(setIsProcessing(false));
      dispatch(startVpn());
    } catch (e) {
      if (e.message && typeof e.message === "string") notifier.error(e.message);
      else notifier.error("Unknown error");
      dispatch(setIsProcessing(false));
    }
  }, [
    activeId,
    additionalRoute,
    currentRule,
    dispatch,
    dns,
    localPort,
    proxy,
    rulePaths
  ]);

  useEffect(() => {
    //TODO: use customized channel for "Disconnected" because there are others message.
    ipcRenderer.on("message", (event, message) => {
      if (message === "Disconnected") {
        dispatch(setIsProcessing(false));
        dispatch(stopVpn());
      }
    });
    return () => {
      ipcRenderer.removeAllListeners("message");
    };
  }, [dispatch]);

  useEffect(() => {
    //TODO:i18next
    ipcRenderer.send("localizationResponse", null);
  }, []);

  useEffect(() => {
    const loadRulePath = async () => {
      setIsLoadingRules(true);
      let rulePaths: string[] = [];
      try {
        // @ts-ignore
        const resourcesPath = await promiseIpc.send("getResourcesPath");
        const defaultRuleDirPath = path.join(resourcesPath, "defaultRules");
        const defaultRules = await fs.promises.readdir(defaultRuleDirPath);
        defaultRules.forEach(rule => {
          if (path.extname(rule) === ".rules")
            rulePaths.push(path.join(defaultRuleDirPath, rule));
        });
      } catch (e) {
        console.log(e);
        notifier.error("Fail to load default rules");
      }
      if (customizedRulesDirPath)
        try {
          const customizedRules = await fs.promises.readdir(
            customizedRulesDirPath
          );
          customizedRules.forEach(rule => {
            if (path.extname(rule) === ".rules")
              rulePaths.push(path.join(customizedRulesDirPath, rule));
          });
        } catch {
          notifier.error("Fail to load customized rules");
        }
      setRulePaths(rulePaths);
    };
    loadRulePath().then(() => {
      setIsLoadingRules(false);
    });
  }, [customizedRulesDirPath]);

  const stop = useCallback(async () => {
    dispatch(setIsProcessing(true));
    try {
      // @ts-ignore
      await promiseIpc.send("stop");
      dispatch(setIsProcessing(false));
      dispatch(stopVpn());
    } catch (e) {
      dispatch(setIsProcessing(false));
    }
  }, [dispatch]);
  const rulesOptions = useMemo(
    () => [
      { value: BUILD_IN_RULE },
      ...rulePaths.map(rulePath => ({
        value: path.basename(rulePath, ".rules")
      }))
    ],
    [rulePaths]
  );
  return (
    <div className={styles.container}>
      {isStarted ? (
        <Button
          isDanger={true}
          className={styles.button}
          onClick={stop}
          isLoading={isProcessing}
          disabled={isProcessing}
        >
          {isProcessing ? "Stopping" : "Stop"}
        </Button>
      ) : (
        <Button
          isPrimary={true}
          className={styles.button}
          onClick={start}
          isLoading={isProcessing}
          disabled={isProcessing}
        >
          {isProcessing ? "Starting" : "Start"}
        </Button>
      )}

      <Selector
        options={rulesOptions}
        label={"Rule"}
        value={currentRule}
        onChange={changeCurrentRule}
        className={styles.selector}
        disabled={isLoadingRules || isStarted || isProcessing}
      />
    </div>
  );
};

export default Header;
