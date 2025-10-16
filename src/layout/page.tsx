import { Header, Footer } from ".";

const Layout = async ({ children }: any) => {
  return (
    <div className="min-h-[100vh] flex flex-col justify-between w-full bg-white dark:bg-[#010814]">
      <Header />
      {children}
      <Footer />
    </div>
  );
};

export default Layout;
