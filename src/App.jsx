import { useEffect, useMemo, useState } from 'react'
import {
  onValue,
  push,
  ref,
  remove,
  set,
  update,
} from 'firebase/database'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import './App.css'
import { analyticsPromise, app, auth, database } from './firebase'

const initialStaffForm = {
  name: '',
  role: '',
  phone: '',
  email: '',
  department: '',
}

const initialAuthForm = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
}

function App() {
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState(initialAuthForm)
  const [authError, setAuthError] = useState('')
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [userRole, setUserRole] = useState('guest')
  const [roleLoading, setRoleLoading] = useState(true)

  const [formData, setFormData] = useState(initialStaffForm)
  const [staffRecords, setStaffRecords] = useState([])
  const [editingId, setEditingId] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deleteId, setDeleteId] = useState('')
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [analyticsReady, setAnalyticsReady] = useState(false)

  const totalStaff = useMemo(() => staffRecords.length, [staffRecords])
  const canWriteStaff = userRole === 'admin' || userRole === 'manager'
  const canDeleteStaff = userRole === 'admin'

  useEffect(() => {
    let isMounted = true

    analyticsPromise
      .then((analytics) => {
        if (isMounted && analytics) {
          setAnalyticsReady(true)
        }
      })
      .catch(() => {
        if (isMounted) {
          setAnalyticsReady(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user)
      setError('')
      setStatusMessage('')

      if (!user) {
        setUserRole('guest')
        setRoleLoading(false)
        setStaffRecords([])
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!currentUser) {
      return undefined
    }

    setRoleLoading(true)

    const userRoleRef = ref(database, `users/${currentUser.uid}/role`)

    const unsubscribe = onValue(
      userRoleRef,
      (snapshot) => {
        const role = snapshot.val()
        setUserRole(role || 'staff')
        setRoleLoading(false)
      },
      () => {
        setUserRole('staff')
        setRoleLoading(false)
      },
    )

    return () => unsubscribe()
  }, [currentUser])

  useEffect(() => {
    if (!currentUser) {
      return undefined
    }

    setLoading(true)
    const staffRef = ref(database, 'staff')

    const unsubscribe = onValue(
      staffRef,
      (snapshot) => {
        const data = snapshot.val()

        if (!data) {
          setStaffRecords([])
          setLoading(false)
          return
        }

        const records = Object.entries(data).map(([id, record]) => ({
          id,
          ...record,
        }))

        records.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

        setStaffRecords(records)
        setLoading(false)
      },
      () => {
        setError('Failed to read staff records. Check Firebase rules and connection.')
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [currentUser])

  const handleAuthInputChange = (event) => {
    const { name, value } = event.target
    setAuthForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  const resetAuthForm = () => {
    setAuthForm(initialAuthForm)
  }

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    setAuthError('')
    setAuthSubmitting(true)

    const email = authForm.email.trim()
    const password = authForm.password

    try {
      if (authMode === 'signup') {
        const fullName = authForm.fullName.trim()

        if (!fullName) {
          setAuthError('Full name is required for sign up.')
          setAuthSubmitting(false)
          return
        }

        if (password !== authForm.confirmPassword) {
          setAuthError('Passwords do not match.')
          setAuthSubmitting(false)
          return
        }

        const credential = await createUserWithEmailAndPassword(auth, email, password)

        await set(ref(database, `users/${credential.user.uid}`), {
          fullName,
          email,
          role: 'staff',
          createdAt: Date.now(),
        })

        setStatusMessage('Account created. Role assigned: staff.')
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }

      resetAuthForm()
    } catch {
      setAuthError('Authentication failed. Check credentials and Firebase Auth settings.')
    } finally {
      setAuthSubmitting(false)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      setEditingId('')
      setFormData(initialStaffForm)
      setStatusMessage('Logged out successfully.')
    } catch {
      setError('Failed to log out.')
    }
  }

  const handleInputChange = (event) => {
    const { name, value } = event.target
    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  const resetForm = () => {
    setFormData(initialStaffForm)
    setEditingId('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setStatusMessage('')

    if (!canWriteStaff) {
      setError('You do not have permission to add or update staff records.')
      return
    }

    const payload = {
      name: formData.name.trim(),
      role: formData.role.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      department: formData.department.trim(),
      updatedAt: Date.now(),
    }

    if (!payload.name || !payload.role || !payload.phone) {
      setError('Name, role, and phone are required.')
      return
    }

    setSubmitting(true)

    try {
      if (editingId) {
        await update(ref(database, `staff/${editingId}`), payload)
        setStatusMessage('Staff member updated.')
      } else {
        const newRef = push(ref(database, 'staff'))
        await set(newRef, {
          ...payload,
          createdAt: Date.now(),
        })
        setStatusMessage('Staff member added.')
      }

      resetForm()
    } catch {
      setError('Failed to save staff member.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (record) => {
    if (!canWriteStaff) {
      setError('You do not have permission to edit staff records.')
      return
    }

    setEditingId(record.id)
    setFormData({
      name: record.name || '',
      role: record.role || '',
      phone: record.phone || '',
      email: record.email || '',
      department: record.department || '',
    })
    setError('')
    setStatusMessage('Editing selected staff member.')
  }

  const handleDelete = async (id) => {
    if (!canDeleteStaff) {
      setError('Only admins can delete staff records.')
      return
    }

    const shouldDelete = window.confirm('Delete this staff member? This action cannot be undone.')

    if (!shouldDelete) {
      return
    }

    setDeleteId(id)
    setError('')
    setStatusMessage('')

    try {
      await remove(ref(database, `staff/${id}`))
      if (editingId === id) {
        resetForm()
      }
      setStatusMessage('Staff member deleted.')
    } catch {
      setError('Failed to delete staff member.')
    } finally {
      setDeleteId('')
    }
  }

  if (!currentUser) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>Staff Management</h1>
          <p className="subtle">Sign in to continue. New accounts are created with role: staff.</p>
          <p className="subtle">Project: {app.options.projectId}</p>

          <form className="staff-form" onSubmit={handleAuthSubmit}>
            {authMode === 'signup' && (
              <label>
                Full Name *
                <input
                  name="fullName"
                  type="text"
                  value={authForm.fullName}
                  onChange={handleAuthInputChange}
                  placeholder="Enter your full name"
                />
              </label>
            )}

            <label>
              Email *
              <input
                name="email"
                type="email"
                value={authForm.email}
                onChange={handleAuthInputChange}
                placeholder="Enter your email"
              />
            </label>

            <label>
              Password *
              <input
                name="password"
                type="password"
                value={authForm.password}
                onChange={handleAuthInputChange}
                placeholder="Enter your password"
              />
            </label>

            {authMode === 'signup' && (
              <label>
                Confirm Password *
                <input
                  name="confirmPassword"
                  type="password"
                  value={authForm.confirmPassword}
                  onChange={handleAuthInputChange}
                  placeholder="Confirm your password"
                />
              </label>
            )}

            <div className="actions">
              <button type="submit" disabled={authSubmitting}>
                {authSubmitting
                  ? 'Please wait...'
                  : authMode === 'signup'
                    ? 'Create Account'
                    : 'Sign In'}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setAuthMode((previous) => (previous === 'login' ? 'signup' : 'login'))
                  setAuthError('')
                  resetAuthForm()
                }}
              >
                {authMode === 'signup' ? 'Use Sign In' : 'Use Sign Up'}
              </button>
            </div>
          </form>

          {authError && <p className="message error">{authError}</p>}
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <h1>Staff Management</h1>
          <p className="subtle">Signed in: {currentUser.email}</p>
          <p className="subtle">Role: {roleLoading ? 'Loading...' : userRole}</p>
        </div>
        <div className="stats">
          <span>Total Staff: {totalStaff}</span>
          <span>Analytics: {analyticsReady ? 'Ready' : 'Unavailable'}</span>
          <button type="button" className="secondary" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </header>

      {canWriteStaff ? (
        <section className="panel">
          <h2>{editingId ? 'Edit Staff Member' : 'Add Staff Member'}</h2>
          <form className="staff-form" onSubmit={handleSubmit}>
            <label>
              Name *
              <input
                name="name"
                type="text"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter name"
              />
            </label>

            <label>
              Role *
              <input
                name="role"
                type="text"
                value={formData.role}
                onChange={handleInputChange}
                placeholder="Enter role"
              />
            </label>

            <label>
              Phone *
              <input
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="Enter phone"
              />
            </label>

            <label>
              Email
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter email"
              />
            </label>

            <label>
              Department
              <input
                name="department"
                type="text"
                value={formData.department}
                onChange={handleInputChange}
                placeholder="Enter department"
              />
            </label>

            <div className="actions">
              <button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : editingId ? 'Update Staff' : 'Add Staff'}
              </button>
              {editingId && (
                <button type="button" className="secondary" onClick={resetForm}>
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </section>
      ) : (
        <section className="panel">
          <h2>Permissions</h2>
          <p className="subtle">Read-only access. Ask an admin to assign role: manager or admin.</p>
        </section>
      )}

      {(error || statusMessage) && (
        <section className="panel">
          {error && <p className="message error">{error}</p>}
          {statusMessage && <p className="message success">{statusMessage}</p>}
        </section>
      )}

      <section className="panel">
        <h2>Staff Directory</h2>

        {loading ? (
          <p className="subtle">Loading staff records...</p>
        ) : staffRecords.length === 0 ? (
          <p className="subtle">No staff records yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staffRecords.map((record) => (
                  <tr key={record.id}>
                    <td>{record.name}</td>
                    <td>{record.role}</td>
                    <td>{record.phone}</td>
                    <td>{record.email || '-'}</td>
                    <td>{record.department || '-'}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => handleEdit(record)}
                          disabled={!canWriteStaff}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => handleDelete(record.id)}
                          disabled={deleteId === record.id || !canDeleteStaff}
                        >
                          {deleteId === record.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

export default App
