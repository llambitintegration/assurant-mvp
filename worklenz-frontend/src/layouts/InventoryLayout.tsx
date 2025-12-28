import { Outlet } from 'react-router-dom';
import { Layout } from '@/shared/antd-imports';
import InventorySider from '@/pages/inventory/sidebar/inventory-sider';

const { Content, Sider } = Layout;

const InventoryLayout = () => {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={250}
        style={{ background: '#fff' }}
        breakpoint="lg"
        collapsedWidth="0"
      >
        <InventorySider />
      </Sider>
      <Layout>
        <Content style={{ padding: '24px', background: '#f0f2f5' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default InventoryLayout;
