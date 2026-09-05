import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usersApi, AdminUserUpdateRequest } from '@/services/api/usersApi';
import { UserResponse } from '@/types/auth';
import AdminSidebar from '@/components/admin/AdminSidebar';
import './AdminDashboardPage.css';
import './UserManagementPage.css';


const PAGE_SIZE = 10;

const roleLabel = (role: string) => role.replace(/_/g, ' ');

const formatDate = (value?: string | null) => {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [role, setRole] = useState('');
  const [isActive, setIsActive] = useState('');

  // View, Edit, Delete state
  const [viewUser, setViewUser] = useState<UserResponse | null>(null);
  const [editUser, setEditUser] = useState<UserResponse | null>(null);
  const [editForm, setEditForm] = useState<AdminUserUpdateRequest>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteUserTarget, setDeleteUserTarget] = useState<UserResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadUsers = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const result = await usersApi.listUsers(page * PAGE_SIZE, PAGE_SIZE, {
        search: search || undefined,
        role: role || undefined,
        is_active: isActive === '' ? undefined : isActive === 'true',
      });
      setUsers(result.items);
      setTotal(result.total);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to load users.';
      setError(message);
      if (!background) setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isActive, page, role, search]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (page >= totalPages && page > 0) setPage(totalPages - 1);
  }, [page, totalPages]);

  const summary = useMemo(() => ({
    active: users.filter((user) => user.is_active).length,
    verified: users.filter((user) => user.is_verified).length,
    admins: users.filter((user) => user.role === 'ADMIN').length,
  }), [users]);

  const applySearch = () => {
    setPage(0);
    setSearch(searchInput.trim());
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setRole('');
    setIsActive('');
    setPage(0);
  };

  const handleOpenEdit = (user: UserResponse) => {
    setEditUser(user);
    setEditForm({
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      is_verified: user.is_verified,
    });
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setSavingEdit(true);
    setEditError(null);

    try {
      const updated = await usersApi.updateAdminUser(editUser.id, editForm);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setEditUser(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update user.';
      setEditError(message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserTarget) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      await usersApi.deleteAdminUser(deleteUserTarget.id);
      setUsers((prev) => prev.filter((u) => u.id !== deleteUserTarget.id));
      setTotal((prev) => Math.max(0, prev - 1));
      setDeleteUserTarget(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete user.';
      setDeleteError(message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="admin-control-center admin-users-page">
      <AdminSidebar activeLabel="Users" />

      <main className="admin-control-center__content">
        <header className="admin-control-center__header">
          <div>
            <p className="admin-control-center__eyebrow">ADMIN CONTROL CENTER</p>
            <h1>Users</h1>
            <p className="admin-control-center__subtitle">
              Server-backed user visibility with ADMIN-only authorization, pagination and safe account status management.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadUsers(true)}
            disabled={refreshing || loading}
            className="admin-control-center__refresh"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </header>

        {error && (
          <div className="admin-control-center__alert" role="alert">
            <strong>Users unavailable.</strong>
            <span>{error}</span>
            <button type="button" onClick={() => void loadUsers()} className="admin-users-page__retry">Retry</button>
          </div>
        )}

        <section className="admin-control-center__panel" aria-labelledby="users-heading">
          <div className="admin-control-center__panel-header">
            <div>
              <h2 id="users-heading">User Directory</h2>
              <p>{total} matching users · page {Math.min(page + 1, totalPages)} of {totalPages}</p>
            </div>
          </div>

          <div className="admin-users-page__filters" role="search">
            <label>
              <span>Search</span>
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') applySearch();
                }}
                placeholder="Name, username or email"
                maxLength={100}
              />
            </label>
            <label>
              <span>Role</span>
              <select value={role} onChange={(event) => { setPage(0); setRole(event.target.value); }}>
                <option value="">All roles</option>
                <option value="ADMIN">Admin</option>
                <option value="TRADER">Trader</option>
                <option value="ANALYST">Analyst</option>
              </select>
            </label>
            <label>
              <span>Status</span>
              <select value={isActive} onChange={(event) => { setPage(0); setIsActive(event.target.value); }}>
                <option value="">All statuses</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </label>
            <div className="admin-users-page__filter-actions">
              <button type="button" onClick={applySearch} disabled={loading}>Apply</button>
              <button type="button" onClick={clearFilters} disabled={loading && !users.length}>Clear</button>
            </div>
          </div>

          <div className="admin-users-page__summary" aria-label="Current page summary">
            <span><strong>{summary.active}</strong> active on page</span>
            <span><strong>{summary.verified}</strong> verified on page</span>
            <span><strong>{summary.admins}</strong> admins on page</span>
          </div>

          {loading && users.length === 0 ? (
            <div className="admin-control-center__loading" role="status">Loading users…</div>
          ) : users.length === 0 ? (
            <div className="admin-control-center__empty">
              <strong>No users found.</strong>
              <span>Try clearing the filters or changing the search criteria.</span>
            </div>
          ) : (
            <div className="admin-users-page__table-wrap">
              <table className="admin-users-page__table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Verification</th>
                    <th>Last Login</th>
                    <th>Created</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.full_name}</strong>
                        <span>@{user.username}</span>
                        <small>{user.email}</small>
                      </td>
                      <td><span className={`admin-users-page__badge admin-users-page__badge--${user.role.toLowerCase()}`}>{roleLabel(user.role)}</span></td>
                      <td><span className={`admin-users-page__status ${user.is_active ? 'is-active' : 'is-inactive'}`}><i />{user.is_active ? 'Active' : 'Inactive'}</span></td>
                      <td><span className={`admin-users-page__verified ${user.is_verified ? 'is-verified' : ''}`}>{user.is_verified ? 'Verified' : 'Unverified'}</span></td>
                      <td>{formatDate(user.last_login)}</td>
                      <td>{formatDate(user.created_at)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="admin-users-page__row-actions">
                          <button
                            type="button"
                            className="admin-users-page__action-btn admin-users-page__action-btn--view"
                            onClick={() => setViewUser(user)}
                            title="View user details"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="admin-users-page__action-btn admin-users-page__action-btn--edit"
                            onClick={() => handleOpenEdit(user)}
                            title="Edit user details"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="admin-users-page__action-btn admin-users-page__action-btn--delete"
                            onClick={() => { setDeleteUserTarget(user); setDeleteError(null); }}
                            title="Delete user"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="admin-users-page__pagination" aria-label="User pagination">
            <button type="button" disabled={page === 0 || loading} onClick={() => setPage((current) => current - 1)}>Previous</button>
            <span>Page {Math.min(page + 1, totalPages)} / {totalPages}</span>
            <button type="button" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((current) => current + 1)}>Next</button>
          </div>
        </section>

        {/* View Modal */}
        {viewUser && (
          <div className="admin-modal-backdrop" onClick={() => setViewUser(null)}>
            <div className="admin-modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <h3>User Profile Details</h3>
                <button type="button" className="admin-modal-close" onClick={() => setViewUser(null)}>×</button>
              </div>
              <div className="admin-modal-body">
                <div className="admin-modal-field">
                  <label>Full Name</label>
                  <p>{viewUser.full_name}</p>
                </div>
                <div className="admin-modal-field">
                  <label>Username</label>
                  <p>@{viewUser.username}</p>
                </div>
                <div className="admin-modal-field">
                  <label>Email Address</label>
                  <p>{viewUser.email}</p>
                </div>
                <div className="admin-modal-field">
                  <label>Role</label>
                  <p><span className={`admin-users-page__badge admin-users-page__badge--${viewUser.role.toLowerCase()}`}>{roleLabel(viewUser.role)}</span></p>
                </div>
                <div className="admin-modal-field">
                  <label>Status</label>
                  <p><span className={`admin-users-page__status ${viewUser.is_active ? 'is-active' : 'is-inactive'}`}><i />{viewUser.is_active ? 'Active' : 'Inactive'}</span></p>
                </div>
                <div className="admin-modal-field">
                  <label>Verification Status</label>
                  <p><span className={`admin-users-page__verified ${viewUser.is_verified ? 'is-verified' : ''}`}>{viewUser.is_verified ? 'Verified' : 'Unverified'}</span></p>
                </div>
                <div className="admin-modal-field">
                  <label>User ID</label>
                  <p><code>{viewUser.id}</code></p>
                </div>
                <div className="admin-modal-field">
                  <label>Last Login</label>
                  <p>{formatDate(viewUser.last_login)}</p>
                </div>
                <div className="admin-modal-field">
                  <label>Created Date</label>
                  <p>{formatDate(viewUser.created_at)}</p>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="admin-modal-btn admin-modal-btn--secondary" onClick={() => setViewUser(null)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editUser && (
          <div className="admin-modal-backdrop" onClick={() => !savingEdit && setEditUser(null)}>
            <div className="admin-modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <h3>Edit User Profile</h3>
                <button type="button" className="admin-modal-close" onClick={() => !savingEdit && setEditUser(null)}>×</button>
              </div>
              <div className="admin-modal-body">
                {editError && <div className="admin-modal-error">{editError}</div>}
                <div className="admin-modal-form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    value={editForm.full_name || ''}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  />
                </div>
                <div className="admin-modal-form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={editForm.email || ''}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </div>
                <div className="admin-modal-form-group">
                  <label>Role</label>
                  <select
                    value={editForm.role || ''}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="TRADER">Trader</option>
                    <option value="ANALYST">Analyst</option>
                  </select>
                </div>
                <div className="admin-modal-form-group">
                  <label>Account Status</label>
                  <select
                    value={editForm.is_active ? 'true' : 'false'}
                    onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === 'true' })}
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
                <div className="admin-modal-form-group">
                  <label>Verification Status</label>
                  <select
                    value={editForm.is_verified ? 'true' : 'false'}
                    onChange={(e) => setEditForm({ ...editForm, is_verified: e.target.value === 'true' })}
                  >
                    <option value="true">Verified</option>
                    <option value="false">Unverified</option>
                  </select>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="admin-modal-btn admin-modal-btn--secondary" disabled={savingEdit} onClick={() => setEditUser(null)}>Cancel</button>
                <button type="button" className="admin-modal-btn admin-modal-btn--primary" disabled={savingEdit} onClick={handleSaveEdit}>
                  {savingEdit ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteUserTarget && (
          <div className="admin-modal-backdrop" onClick={() => !deleting && setDeleteUserTarget(null)}>
            <div className="admin-modal-box admin-modal-box--danger" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <h3>Confirm User Deletion</h3>
                <button type="button" className="admin-modal-close" onClick={() => !deleting && setDeleteUserTarget(null)}>×</button>
              </div>
              <div className="admin-modal-body">
                {deleteError && <div className="admin-modal-error">{deleteError}</div>}
                <p>Are you sure you want to delete user <strong>{deleteUserTarget.full_name}</strong> (<code>{deleteUserTarget.email}</code>)?</p>
                <p className="admin-modal-warning-text">This action cannot be undone.</p>
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="admin-modal-btn admin-modal-btn--secondary" disabled={deleting} onClick={() => setDeleteUserTarget(null)}>Cancel</button>
                <button type="button" className="admin-modal-btn admin-modal-btn--danger" disabled={deleting} onClick={handleDeleteUser}>
                  {deleting ? 'Deleting…' : 'Delete User'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default UserManagementPage;

