import { Menu } from '@/shared/antd-imports';
import { useNavigate, useLocation } from 'react-router-dom';
import { INVENTORY_MENU_ITEMS } from '@/lib/inventory/inventory-constants';

const InventorySider = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Find current selected key based on pathname
  const selectedKey = INVENTORY_MENU_ITEMS.find(item =>
    location.pathname.includes(item.path)
  )?.key || 'dashboard';

  const handleMenuClick = ({ key }: { key: string }) => {
    const item = INVENTORY_MENU_ITEMS.find(i => i.key === key);
    if (item) {
      navigate(item.path);
    }
  };

  return (
    <Menu
      mode="inline"
      selectedKeys={[selectedKey]}
      items={INVENTORY_MENU_ITEMS.map(item => ({
        key: item.key,
        icon: item.icon,
        label: item.label,
      }))}
      onClick={handleMenuClick}
      style={{ height: '100%', borderRight: 0 }}
    />
  );
};

export default InventorySider;
