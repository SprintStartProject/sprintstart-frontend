import { AppRouter } from './router/AppRouter';
import { SideBar } from './components/layout/SideBar';

function App() {
  return (
      <div className="flex min-h-screen w-full bg-gray-950">
        <SideBar />

        <main className="min-h-screen flex-1 bg-gray-950 pt-[64px] lg:pt-0">
          <AppRouter />
        </main>
      </div>
  );
}

export default App;