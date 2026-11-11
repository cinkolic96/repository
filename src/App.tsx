import { NavLink, Route, Routes } from 'react-router-dom';
import { IconShield, IconCalendar, IconCar, IconChart, IconHome, IconKey, IconMore, IconSettings, IconUsers, IconWallet } from './components/icons';
import { useDB } from './lib/store';
import { useSession } from './lib/session';
import SyncBadge from './components/SyncBadge';
import Dashboard from './pages/Dashboard';
import CalendarPage from './pages/Calendar';
import Rentals from './pages/Rentals';
import RentalForm from './pages/RentalForm';
import RentalDetail from './pages/RentalDetail';
import Vehicles from './pages/Vehicles';
import VehicleForm from './pages/VehicleForm';
import VehicleDetail from './pages/VehicleDetail';
import Customers from './pages/Customers';
import CustomerForm from './pages/CustomerForm';
import CustomerDetail from './pages/CustomerDetail';
import Expenses from './pages/Expenses';
import Reports from './pages/Reports';
import SettingsPage from './pages/Settings';
import More from './pages/More';
import AdminPage from './pages/Admin';

const allLinks = [
  { to: '/', label: 'Pregled', icon: <IconHome />, end: true },
  { to: '/kalendar', label: 'Kalendar', icon: <IconCalendar /> },
  { to: '/izdavanja', label: 'Izdavanja', icon: <IconKey /> },
  { to: '/vozila', label: 'Vozila', icon: <IconCar /> },
  { to: '/klijenti', label: 'Klijenti', icon: <IconUsers /> },
  { to: '/troskovi', label: 'Troškovi', icon: <IconWallet /> },
  { to: '/izvjestaji', label: 'Izvještaji', icon: <IconChart />, ownerOnly: true },
  { to: '/podesavanja', label: 'Podešavanja', icon: <IconSettings /> },
];

export default function App() {
  const { settings } = useDB();
  const session = useSession();
  const isOwner = session.role === 'owner';
  const links = [
    ...allLinks.filter((l) => isOwner || !l.ownerOnly),
    ...(session.isAdmin ? [{ to: '/admin', label: 'Administracija', icon: <IconShield /> }] : []),
  ];
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img src="icon.svg" alt="" />
          <div>
            RentManager
            <small>{settings.agencyName}</small>
          </div>
        </div>
        <nav className="nav">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>
              {l.icon}
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <SyncBadge />
          {session.email && (
            <div className="small muted" style={{ marginTop: 8, wordBreak: 'break-all' }}>
              {session.email}
              <div>{isOwner ? 'Vlasnik' : 'Radnik'}</div>
            </div>
          )}
          {session.switchAgency && <button className="btn small" style={{ marginTop: 8, width: '100%' }} onClick={session.switchAgency}>Promijeni agenciju</button>}
          {session.signOut && <button className="btn small" style={{ marginTop: 8, width: '100%' }} onClick={session.signOut}>Odjavi se</button>}
        </div>
      </aside>
      <main className="main">
        <div className="mobile-sync"><SyncBadge /></div>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/kalendar" element={<CalendarPage />} />
          <Route path="/izdavanja" element={<Rentals />} />
          <Route path="/izdavanja/novo" element={<RentalForm />} />
          <Route path="/izdavanja/:id" element={<RentalDetail />} />
          <Route path="/izdavanja/:id/uredi" element={<RentalForm />} />
          <Route path="/vozila" element={<Vehicles />} />
          <Route path="/vozila/novo" element={<VehicleForm />} />
          <Route path="/vozila/:id" element={<VehicleDetail />} />
          <Route path="/vozila/:id/uredi" element={<VehicleForm />} />
          <Route path="/klijenti" element={<Customers />} />
          <Route path="/klijenti/novo" element={<CustomerForm />} />
          <Route path="/klijenti/:id" element={<CustomerDetail />} />
          <Route path="/klijenti/:id/uredi" element={<CustomerForm />} />
          <Route path="/troskovi" element={<Expenses />} />
          {isOwner && <Route path="/izvjestaji" element={<Reports />} />}
          {session.isAdmin && <Route path="/admin" element={<AdminPage />} />}
          <Route path="/podesavanja" element={<SettingsPage />} />
          <Route path="/vise" element={<More links={links.slice(4)} />} />
          <Route path="*" element={<div className="empty">Stranica ne postoji.</div>} />
        </Routes>
      </main>
      <nav className="bottom-nav">
        {links.slice(0, 4).map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end}>
            {l.icon}
            {l.label}
          </NavLink>
        ))}
        <NavLink to="/vise">
          <IconMore />
          Više
        </NavLink>
      </nav>
    </div>
  );
}
