import React, {
  useState,
  useMemo,
  createContext,
  MutableRefObject,
  Dispatch,
  SetStateAction,
  useCallback
} from "react";
import { useSelector, useDispatch } from "react-redux";
import { AppState } from "../../reducers/rootReducer";
import { deleteProxy, ProxyState } from "../../reducers/proxyReducer";
import styles from "./proxies.module.css";
import { Dialog, ICON_NAME, Menu } from "../Core";
import { usePopup } from "../../hooks";
import { Shadowsockses } from "./Shadowsockses";
import { Socks5s } from "./Socks5s";
import { Subscriptions } from "./Subscriptions";
import { encodeSsUrl } from "../../utils/url";
import { clipboard } from "electron";
import { notifier } from "../Core/Notification";
import QRCode from "qrcode";
import { EditShadowsocksDialog } from "../Dialogs/EditShadowsocksDialog";

//TODO:Remove improper type
export type ProxiesContextValue = {
  dropdownRef: MutableRefObject<HTMLElement | undefined>;
  setIsShowDropdown: Dispatch<SetStateAction<boolean>>;
  setEditingId: (id: string) => void;
};
export const ProxiesContext = createContext<ProxiesContextValue | null>(null);

export const Proxies = () => {
  const proxy = useSelector<AppState, ProxyState>(state => state.proxy);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState("");
  const activatedId = useSelector<AppState, string>(
    state => state.proxy.activeId
  );
  const isStartedOrProcessing = useSelector<AppState, boolean>(
    state => state.proxy.isProcessing || state.proxy.isStarted
  );
  const [isShowQrCode, setIsShowQrCode] = useState(false);
  const dispatch = useDispatch();

  const getEditingShadowsocks = useCallback(() => {
    const shadowsocks = proxy.shadowsockses.find(
      shadowsocks => shadowsocks.id === editingId
    );
    if (!shadowsocks) {
      const subscription = proxy.subscriptions.find(subscription =>
        subscription.shadowsockses.some(
          shadowsocks => shadowsocks.id === editingId
        )
      );
      //Shadowsocks is sure to be found.
      return subscription?.shadowsockses.find(
        shadowsocks => shadowsocks.id === editingId
      );
    }
    return shadowsocks;
  }, [editingId, proxy.shadowsockses, proxy.subscriptions]);

  const dropdownItems = useMemo(() => {
    const isActivated = activatedId === editingId && isStartedOrProcessing;

    return [
      {
        iconName: ICON_NAME.EDIT,
        content: "Edit",
        handleOnClick: () => {
          setIsEditing(true);
        },
        disabled: isActivated
      },
      {
        iconName: ICON_NAME.COPY,
        content: "Copy Url",
        handleOnClick: async () => {
          const shadowsocks = getEditingShadowsocks();
          if (shadowsocks) {
            const url = encodeSsUrl(shadowsocks);
            await clipboard.writeText(url);
            notifier.success("Copy Url successfully");
          }
        }
      },
      {
        iconName: ICON_NAME.QRCODE,
        content: "Share QrCode",
        handleOnClick: async () => {
          const shadowsocks = getEditingShadowsocks();
          if (shadowsocks) {
            const url = encodeSsUrl(shadowsocks);
            await QRCode.toCanvas(document.getElementById("qr-code"), url);
            setIsShowQrCode(true);
          }
        }
      },

      {
        iconName: ICON_NAME.DELETE,
        isDanger: true,
        content: "Delete",
        handleOnClick: () => {
          dispatch(deleteProxy({ type: "shadowsocks", id: editingId }));
        },
        disabled: isActivated
      }
    ];
  }, [
    activatedId,
    dispatch,
    editingId,
    getEditingShadowsocks,
    isStartedOrProcessing
  ]);
  const [dropdownRef, setIsShowDropdown] = usePopup(
    <Menu items={dropdownItems} />
  );

  const closeEditDialog = useCallback(() => setIsEditing(false), []);
  const closeQrCodeDialog = useCallback(() => setIsShowQrCode(false), []);

  return (
    <>
      {isEditing && (
        <EditShadowsocksDialog
          isShow={isEditing}
          close={closeEditDialog}
          initialValue={getEditingShadowsocks()}
        />
      )}

      <Dialog isShow={isShowQrCode} close={closeQrCodeDialog}>
        <canvas id="qr-code" />
      </Dialog>
      <div className={styles.container}>
        <ProxiesContext.Provider
          value={{
            dropdownRef,
            setIsShowDropdown,
            setEditingId
          }}
        >
          <Shadowsockses />
          <Subscriptions />
        </ProxiesContext.Provider>
        <Socks5s />
      </div>
    </>
  );
};

export default Proxies;
