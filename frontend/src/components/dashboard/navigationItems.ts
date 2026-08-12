import { ROUTES } from "../../constants/routes";

export interface NavigationItem {
  label: string;
  path: string;
}

export const navigationItems: NavigationItem[] = [
  { label: "Dashboard", path: ROUTES.DASHBOARD },
  { label: "Markets", path: ROUTES.WATCHLIST },
  { label: "Strategy", path: ROUTES.STRATEGY },
  { label: "Portfolio", path: ROUTES.PORTFOLIO },
  { label: "Orders", path: ROUTES.ORDERS },
  { label: "Journal", path: ROUTES.JOURNAL },
  { label: "Brokers", path: ROUTES.BROKERS },
  { label: "Kill Switch", path: ROUTES.KILL_SWITCH },
];
