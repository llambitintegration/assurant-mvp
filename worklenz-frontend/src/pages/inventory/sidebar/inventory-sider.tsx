import { ConfigProvider, Flex, Menu } from '@/shared/antd-imports';
import { Link, useLocation } from 'react-router-dom';
import { colors } from '@/styles/colors';
import { INVENTORY_MENU_ITEMS } from '@/lib/inventory/inventory-constants';
import { useMemo } from 'react';

const InventorySider = () => {
  const location = useLocation();

  const menuItems = useMemo(
    () =>
      INVENTORY_MENU_ITEMS.map(item => ({
        key: item.key,
        icon: item.icon,
        label: <Link to={item.path}>{item.label}</Link>,
      })),
    []
  );

  const activeKey = useMemo(() => {
    const pathParts = location.pathname.split('/worklenz/inventory/')[1];
    return pathParts?.split('/')[0] || 'dashboard';
  }, [location.pathname]);

  return (
    <ConfigProvider
      theme={{
        components: {
          Menu: {
            subMenuItemBg: colors.transparent,
          },
        },
      }}
    >
      <Flex gap={24} vertical>
        <Menu
          className="custom-inventory-sider"
          items={menuItems}
          selectedKeys={[activeKey]}
          mode="inline"
          style={{ width: '100%' }}
        />
      </Flex>
    </ConfigProvider>
  );
};

export default InventorySider;
