import React, { useState, useEffect, useMemo } from "react";
import "./App.css";

// Interface definitions (simplified to avoid strict type issues if @types is missing)
interface Medicine {
  id: number;
  name: string;
  category: string;
  quantity: number;
  price: string | number;
  expiry_date: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState("inventory");
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminSetupRequired, setAdminSetupRequired] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loggedInUser, setLoggedInUser] = useState("");

  // Form State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentMedId, setCurrentMedId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", category: "General", quantity: 0, price: 0, expiry_date: "" });

  const API_URL = "http://13.204.98.231:3000";

  // Check Admin setup on load
  useEffect(() => {
    checkAdminSetup();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchMedicines();
    }
  }, [isAuthenticated]);

  const checkAdminSetup = async () => {
    try {
      const res = await fetch(`${API_URL}/admins/check`);
      const data = await res.json();
      if (!data.hasAdmins) {
        setAdminSetupRequired(true);
      }
    } catch (err) {
      console.error("Failed to check admin status", err);
    }
  };

  const handleLogin = async (e: any) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/admins/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: adminUsername, password: adminPassword })
      });
      const data = await res.json();
      if (data.success) {
        setIsAuthenticated(true);
        setLoggedInUser(data.username);
      } else {
        alert(data.error || "Login Failed");
      }
    } catch (err) {
      alert("Error connecting to server.");
    }
  };

  const handleInitialSetup = async (e: any) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/admins/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: adminUsername, password: adminPassword })
      });
      const data = await res.json();
      if (data.success) {
        alert("Admin created! You can now log in.");
        setAdminSetupRequired(false);
        setAdminPassword("");
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("Error registering admin");
    }
  };

  const handleCreateNewAdmin = async (e: any) => {
    e.preventDefault();
    const newUser = e.target.newUsername.value;
    const newPass = e.target.newPassword.value;
    // For simplicity, we use the same register endpoint (Backend allows multiple if modified, 
    // but right now it blocks if count > 0. Let's assume we can remove the block later, 
    // or we just show a mock UI for it).
    alert(`Admin ${newUser} feature requires backend permission changes. Coming soon!`);
    e.target.reset();
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setLoggedInUser("");
    setAdminUsername("");
    setAdminPassword("");
  };

  const fetchMedicines = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/medicines`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setMedicines(data);
    } catch (err) {
      console.error("Failed to fetch medicines", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: any) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ 
      ...prev, 
      [name]: name === "quantity" || name === "price" ? parseFloat(value) || 0 : value 
    }));
  };

  const openAddModal = () => {
    setFormData({ name: "", category: "Tablets", quantity: 0, price: 0, expiry_date: "" });
    setIsEditing(false);
    setCurrentMedId(null);
    setShowModal(true);
  };

  const openEditModal = (med: Medicine) => {
    const formattedDate = new Date(med.expiry_date).toISOString().split('T')[0];
    setFormData({ name: med.name, category: med.category || "General", quantity: med.quantity, price: Number(med.price), expiry_date: formattedDate });
    setIsEditing(true);
    setCurrentMedId(med.id);
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  const saveMedicine = async (e: any) => {
    e.preventDefault();
    try {
      const method = isEditing ? "PUT" : "POST";
      const url = isEditing ? `${API_URL}/medicines/${currentMedId}` : `${API_URL}/medicines`;
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if(!res.ok) throw new Error("Server error");
      closeModal();
      fetchMedicines();
    } catch (err) {
      alert("Error saving data. Please ensure the backend is running.");
    }
  };

  const deleteMedicine = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this?")) return;
    try {
      await fetch(`${API_URL}/medicines/${id}`, { method: "DELETE" });
      fetchMedicines();
    } catch (err) {
      alert("Error deleting data");
    }
  };

  const sellMedicine = async (id: number, currentQty: number) => {
    if (currentQty <= 0) return alert("Out of stock!");
    try {
      await fetch(`${API_URL}/medicines/${id}/sell`, { method: "POST" });
      fetchMedicines();
    } catch (err) {
      alert("Error processing sale");
    }
  };

  const getStatusInfo = (med: Medicine) => {
    const expiry = new Date(med.expiry_date);
    const now = new Date();
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { label: "Expired", class: "badge-danger" };
    if (diffDays <= 30) return { label: "Expiring Soon", class: "badge-warning" };
    if (med.quantity === 0) return { label: "Out of Stock", class: "badge-danger" };
    if (med.quantity < 20) return { label: "Low Stock", class: "badge-warning" };
    return { label: "In Stock", class: "badge-success" };
  };

  const filteredMedicines = useMemo(() => {
    return medicines.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || m.category.toLowerCase().includes(search.toLowerCase()));
  }, [medicines, search]);

  const totalStock = medicines.reduce((sum, med) => sum + med.quantity, 0);
  const totalValue = medicines.reduce((sum, med) => sum + (med.quantity * Number(med.price)), 0);
  const lowStockCount = medicines.filter(m => m.quantity > 0 && m.quantity < 20).length;
  const outOfStockCount = medicines.filter(m => m.quantity === 0).length;

  // --- RENDER AUTH SCREEN ---
  if (!isAuthenticated) {
    return (
      <div className="auth-container">
        <div className="auth-box">
          <div className="logo auth-logo"><span className="icon">⚕️</span> MedShop Pro</div>
          <h2>{adminSetupRequired ? "Welcome! Let's Setup" : "Admin Login"}</h2>
          <p className="auth-subtitle">
            {adminSetupRequired ? "No admin found. Create your master account." : "Enter your credentials to manage inventory"}
          </p>
          
          <form className="modern-form" onSubmit={adminSetupRequired ? handleInitialSetup : handleLogin}>
            <div className="form-group">
              <label>Admin Username</label>
              <input type="text" value={adminUsername} onChange={e => setAdminUsername(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} required />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}>
              {adminSetupRequired ? "Register Master Admin" : "Log In securely"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- RENDER MAIN LAYOUT ---
  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo">
          <span className="icon">⚕️</span> MedShop Pro
        </div>
        <ul className="nav-menu">
          <li className={`nav-item ${activeTab === "inventory" ? "active" : ""}`} onClick={() => setActiveTab("inventory")}>
             <span className="nav-icon">📦</span> Inventory
          </li>
          <li className={`nav-item ${activeTab === "reports" ? "active" : ""}`} onClick={() => setActiveTab("reports")}>
             <span className="nav-icon">📊</span> Reports
          </li>
          <li className={`nav-item ${activeTab === "pos" ? "active" : ""}`} onClick={() => setActiveTab("pos")}>
             <span className="nav-icon">💳</span> Point of Sale
          </li>
          <li className={`nav-item ${activeTab === "settings" ? "active" : ""}`} onClick={() => setActiveTab("settings")}>
             <span className="nav-icon">⚙️</span> Settings
          </li>
        </ul>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="header">
          <div className="welcome-text">
            <h1>{activeTab === 'inventory' ? 'Inventory Management' : activeTab === 'reports' ? 'Business Reports' : activeTab === 'pos' ? 'Point of Sale' : 'System Settings'}</h1>
            <p className="subtitle">Real-time data and tracking</p>
          </div>
          <div className="header-actions">
            {activeTab === 'inventory' && (
              <div className="search-box">
                <span className="search-icon">🔍</span>
                <input 
                  type="text" 
                  placeholder="Search medicines..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            )}
            <div className="user-profile">
              <div className="avatar">{loggedInUser.charAt(0).toUpperCase()}</div>
              <span>{loggedInUser}</span>
            </div>
          </div>
        </header>

        {/* TAB: INVENTORY */}
        {activeTab === "inventory" && (
          <>
            <section className="inventory-section">
              <div className="section-header">
                <h2>Database</h2>
                <button className="btn-primary" onClick={openAddModal}>
                  <span className="plus">+</span> Add Medicine
                </button>
              </div>
              
              {loading ? (
                <div className="loader">Loading database...</div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Medicine Details</th>
                        <th>Category</th>
                        <th>Stock</th>
                        <th>Price</th>
                        <th>Expiry Date</th>
                        <th>Status</th>
                        <th>Quick Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMedicines.map((med) => {
                        const status = getStatusInfo(med);
                        return (
                          <tr key={med.id}>
                            <td className="medicine-name">{med.name}</td>
                            <td><span className="category-pill">{med.category || 'General'}</span></td>
                            <td><strong className={med.quantity < 20 ? "text-danger" : ""}>{med.quantity}</strong> Units</td>
                            <td>₹{Number(med.price).toFixed(2)}</td>
                            <td>{new Date(med.expiry_date).toLocaleDateString()}</td>
                            <td><span className={`badge ${status.class}`}>{status.label}</span></td>
                            <td className="actions-cell">
                              <button 
                                className="btn-action btn-sell tooltip" 
                                onClick={() => sellMedicine(med.id, med.quantity)}
                                disabled={med.quantity === 0}
                                title="Quick Sell 1 Unit"
                              >
                                🛒
                              </button>
                              <button className="btn-action btn-edit tooltip" onClick={() => openEditModal(med)} title="Edit">✏️</button>
                              <button className="btn-action btn-delete tooltip" onClick={() => deleteMedicine(med.id)} title="Delete">🗑️</button>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredMedicines.length === 0 && (
                        <tr>
                          <td colSpan={7} className="empty-state">
                            <div className="empty-icon">📭</div>
                            <p>No medicines found.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {/* TAB: REPORTS */}
        {activeTab === "reports" && (
           <section className="reports-section">
             <div className="stats-grid">
              <div className="stat-card blue">
                <div className="icon-wrapper">💊</div>
                <div><div className="label">Total Varieties</div><div className="value">{medicines.length}</div></div>
              </div>
              <div className="stat-card green">
                <div className="icon-wrapper">💵</div>
                <div><div className="label">Total Value (₹)</div><div className="value">₹{totalValue.toLocaleString()}</div></div>
              </div>
              <div className="stat-card warning">
                <div className="icon-wrapper">⚠️</div>
                <div><div className="label">Low Stock items</div><div className="value">{lowStockCount}</div></div>
              </div>
              <div className="stat-card danger">
                <div className="icon-wrapper">🚨</div>
                <div><div className="label">Out of Stock items</div><div className="value">{outOfStockCount}</div></div>
              </div>
            </div>
           </section>
        )}

        {/* TAB: POS */}
        {activeTab === "pos" && (
           <section className="inventory-section pos-section">
             <h2>Terminal Point of Sale</h2>
             <p className="text-muted" style={{marginBottom: '2rem'}}>Quick checkouts and billing functions go here.</p>
             <div className="grid-2">
                <div className="search-box" style={{width: '100%', marginBottom: '1rem'}}>
                  <span className="search-icon">🔍</span>
                  <input type="text" placeholder="Scan Barcode or search item to bill..." style={{width: '100%'}}/>
                </div>
                <button className="btn-primary" style={{width: 'wrap-content'}}>Checkout Customer</button>
             </div>
           </section>
        )}

        {/* TAB: SETTINGS */}
        {activeTab === "settings" && (
           <section className="inventory-section settings-section">
             <h2>Admin Settings</h2>
             
             <div className="settings-block" style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid var(--glass-border)', borderRadius: '16px', maxWidth: '600px'}}>
               <h3 style={{marginBottom: '1rem'}}>Create New Admin ID</h3>
               <form className="modern-form" style={{padding:0}} onSubmit={handleCreateNewAdmin}>
                 <div className="form-row">
                   <div className="form-group half">
                     <label>New Username</label>
                     <input type="text" name="newUsername" required/>
                   </div>
                   <div className="form-group half">
                     <label>Password</label>
                     <input type="password" name="newPassword" required/>
                   </div>
                 </div>
                 <button type="submit" className="btn-primary">Create User</button>
               </form>
             </div>

             <div className="settings-block" style={{ marginTop: '2rem'}}>
                <button className="btn-secondary" style={{borderColor: 'var(--danger)', color: 'var(--danger)'}} onClick={handleLogout}>Log Out</button>
             </div>
           </section>
        )}

      </main>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{isEditing ? "Edit Medicine Details" : "Register New Medicine"}</h2>
              <button className="btn-close" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={saveMedicine} className="modern-form">
              <div className="form-group">
                <label>Medicine Name</label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} required placeholder="e.g. Paracetamol 500mg" />
              </div>
              
              <div className="form-row">
                <div className="form-group half">
                  <label>Category</label>
                  <select name="category" value={formData.category} onChange={handleInputChange}>
                    <option value="Tablets">Tablets</option>
                    <option value="Syrups">Syrups</option>
                    <option value="Injections">Injections</option>
                    <option value="Ointments">Ointments</option>
                    <option value="First Aid">First Aid</option>
                    <option value="General">General</option>
                  </select>
                </div>
                <div className="form-group half">
                  <label>Price (₹)</label>
                  <input type="number" name="price" value={formData.price} onChange={handleInputChange} required min="0" step="0.01" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group half">
                  <label>Initial Quantity</label>
                  <input type="number" name="quantity" value={formData.quantity} onChange={handleInputChange} required min="0" />
                </div>
                <div className="form-group half">
                  <label>Expiry Date</label>
                  <input type="date" name="expiry_date" value={formData.expiry_date} onChange={handleInputChange} required />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary">
                  {isEditing ? "Save Changes" : "Confirm Registration"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
