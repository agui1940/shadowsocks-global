import styles from "./menu.module.css";
import { BUTTON_SIZE, Button, Icon } from "..";
import classNames from "classnames";
import React from "react";
import { FixedSizeList as List } from "react-window";

const VIRTUALIZED_ITEM_SIZE = 35;
const VIRTUALIZED_ITEM_WIDTH = 188;
const VIRTUALIZED_ITEM_HEIGHT = 150;

export type MenuItemProps = {
  content?: React.ReactNode;
  iconType?: "iconFont" | "flag";
  iconName?: string;
  handleOnClick?: Function;
  isDivider?: boolean;
  isDanger?: boolean;
  style?: any;
  disabled?: boolean;
};

type MenuProps = {
  items: MenuItemProps[];
  className?: string;
  isVirtualized?: boolean;
};

//TODO: Refactor Menu to improve performance
export const Menu = React.memo((props: MenuProps) => {
  const { items, className, isVirtualized } = props;
  return (
    <div className={classNames(styles.container, className)}>
      {isVirtualized ? (
        <List
          itemCount={items.length}
          itemSize={VIRTUALIZED_ITEM_SIZE}
          width={VIRTUALIZED_ITEM_WIDTH}
          height={VIRTUALIZED_ITEM_HEIGHT}
          className={styles.list}
          itemData={items}
        >
          {VirtualizedItem}
        </List>
      ) : (
        <ul className={styles.list}>
          {items.map((itemProps, index) => (
            <Item {...itemProps} key={index} />
          ))}
        </ul>
      )}
    </div>
  );
});

const VirtualizedItem = React.memo(
  (props: { data: MenuItemProps[]; index: number; style: any }) => (
    <Item {...props.data[props.index]} style={props.style} />
  )
);

const Item = React.memo((props: MenuItemProps) => {
  const {
    handleOnClick,
    iconType = "iconFont",
    iconName,
    isDivider = false,
    content,
    isDanger,
    style,
    disabled
  } = props;

  return (
    <div style={style} className={disabled ? styles.disabled : ""}>
      {isDivider && <li className={styles.divider} />}
      <li
        className={classNames(styles.item, {
          [styles.danger]: isDanger,
          [styles.disabled]: disabled
        })}
        onClick={() => handleOnClick && handleOnClick()}
      >
        {typeof content !== "string" ? (
          content
        ) : (
          <Button size={BUTTON_SIZE.large}>
            {iconName && <Icon iconName={iconName} type={iconType} />}
            <span className={styles.content}>{content}</span>
          </Button>
        )}
      </li>
    </div>
  );
});
