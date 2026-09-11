import { SessionProvider, useSession } from './state/session';
import { LeftRail } from './shell/LeftRail';
import { Hud } from './shell/Hud';
import { ExitBar, PauseOverlay } from './shell/ExitBar';
import { Today, Tier, Copilot, Review } from './views';
import './app.css';

function CurrentView() {
  const { route } = useSession();
  switch (route) {
    case 'tier1':
      return <Tier tier={1} />;
    case 'tier2':
      return <Tier tier={2} />;
    case 'copilot':
      return <Copilot />;
    case 'review':
      return <Review />;
    default:
      return <Today />;
  }
}

function Shell() {
  const { focusMode } = useSession();
  return (
    <div class={`shell${focusMode ? ' shell--focus' : ''}`}>
      <a class="skiplink" href="#main">
        Skip to content
      </a>
      <LeftRail />
      <Hud />
      <main class="main" id="main" tabIndex={-1}>
        <div class="main__inner">
          <CurrentView />
        </div>
      </main>
      <ExitBar />
      <PauseOverlay />
    </div>
  );
}

export function App() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  );
}
