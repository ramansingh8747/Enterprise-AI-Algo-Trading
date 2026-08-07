export const Sidebar = ({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) => (
  <aside className="sidebar" style={{ width: isOpen ? '250px' : '60px' }}>
    Sidebar
    <button onClick={onToggle}>Toggle</button>
  </aside>
);
