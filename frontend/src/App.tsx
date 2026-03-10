import React, { useState, useEffect, useMemo, useRef } from "react";
import { Pill, Activity, ShoppingCart, Settings, Users, Plus, Search, LogOut, CheckCircle2, ShieldAlert, HeartPulse, Trash2, Edit3, X, FileText, Camera, Moon, Sun, Loader2 } from "lucide-react";
import Tesseract from "tesseract.js";
import "./App.css";

interface Medicine {
  id: number;
  name: string;
  category: string;
  quantity: number;
  price: string | number;
  expiry_date: string;
  supplier_id?: number;
}

interface Supplier {
  id: number;
  name: string;
  contact_number: string;
  email: string;
  address: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState("inventory");
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminSetupRequired, setAdminSetupRequired] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loggedInUser, setLoggedInUser] = useState("");

  // Modals & Forms
  const [showModal, setShowModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentMedId, setCurrentMedId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", category: "General", quantity: 0, price: 0, expiry_date: "", supplier_id: "" });
  const [supplierFormData, setSupplierFormData] = useState({ name: "", contact_number: "", email: "", address: "" });

  // POS State
  const [posCart, setPosCart] = useState<Array<Medicine & { cartQuantity: number }>>([]);
  const [posSearch, setPosSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState(false);

  const API_URL = "http://13.204.98.231:3000";

  useEffect(() => {
    checkAdminSetup();
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dark-mode", isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchMedicines(), fetchSuppliers()]);
    setLoading(false);
  };

  const checkAdminSetup = async () => {
    try {
      const res = await fetch(`${API_URL}/admins/check`);
      const data = await res.json();
      if (!data.hasAdmins) setAdminSetupRequired(true);
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

  const handleLogout = () => {
    setIsAuthenticated(false);
    setLoggedInUser("");
    setAdminUsername("");
    setAdminPassword("");
  };

  // --- API Calls ---
  const fetchMedicines = async () => {
    try {
      const res = await fetch(`${API_URL}/medicines`);
      if (res.ok) setMedicines(await res.json());
    } catch (err) { console.error("Fetch med error", err); }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch(`${API_URL}/suppliers`);
      if (res.ok) setSuppliers(await res.json());
    } catch (err) { console.error("Fetch sup error", err); }
  };

  // --- Inventory Form Handlers ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: typeof formData) => ({
      ...prev,
      [name]: name === "quantity" || name === "price" ? parseFloat(value) || 0 : value
    }));
  };

  const openAddModal = () => {
    setFormData({ name: "", category: "Tablets", quantity: 0, price: 0, expiry_date: "", supplier_id: "" });
    setIsEditing(false);
    setShowModal(true);
  };

  const openEditModal = (med: Medicine) => {
    const formattedDate = new Date(med.expiry_date).toISOString().split('T')[0];
    setFormData({
      name: med.name,
      category: med.category || "General",
      quantity: med.quantity,
      price: Number(med.price),
      expiry_date: formattedDate,
      supplier_id: med.supplier_id ? med.supplier_id.toString() : ""
    });
    setIsEditing(true);
    setCurrentMedId(med.id);
    setShowModal(true);
  };

  const saveMedicine = async (e: any) => {
    e.preventDefault();
    try {
      const method = isEditing ? "PUT" : "POST";
      const url = isEditing ? `${API_URL}/medicines/${currentMedId}` : `${API_URL}/medicines`;
      const payload = { ...formData, supplier_id: formData.supplier_id ? parseInt(formData.supplier_id) : null };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Server error");
      setShowModal(false);
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
    } catch (err) { alert("Error deleting data"); }
  };

  // --- Supplier Form Handlers ---
  const saveSupplier = async (e: any) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/suppliers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(supplierFormData),
      });
      if (res.ok) {
        setShowSupplierModal(false);
        fetchSuppliers();
      }
    } catch (err) { alert("Error creating supplier"); }
  };

  const deleteSupplier = async (id: number) => {
    if (!window.confirm("Delete this supplier?")) return;
    try {
      await fetch(`${API_URL}/suppliers/${id}`, { method: "DELETE" });
      fetchSuppliers();
    } catch (err) { alert("Error deleting data"); }
  };

  // --- POS Logic ---
  const addToPosCart = (med: Medicine) => {
    const existing = posCart.find(item => item.id === med.id);
    if (existing) {
      if (existing.cartQuantity < existing.quantity) {
        setPosCart(posCart.map(i => i.id === med.id ? { ...i, cartQuantity: i.cartQuantity + 1 } : i));
      } else {
        alert("Not enough stock available!");
      }
    } else {
      if (med.quantity > 0) {
        setPosCart([...posCart, { ...med, cartQuantity: 1 }]);
      } else {
        alert("Out of stock!");
      }
    }
    setPosSearch("");
  };

  const removeFromPosCart = (id: number) => {
    setPosCart(posCart.filter(item => item.id !== id));
  };

  const updateCartQuantity = (id: number, newQty: number) => {
    if (newQty < 1) return;
    setPosCart(prev => prev.map(item => item.id === id ? { ...item, cartQuantity: newQty } : item));
  };

  const handleCheckout = async () => {
    if (posCart.length === 0) return alert("Cart is empty");
    const total_amount = posCart.reduce((sum: number, item: any) => sum + (item.cartQuantity * Number(item.price)), 0);
    const items = posCart.map((i: any) => ({ medicine_id: i.id, quantity: i.cartQuantity, price: i.price }));

    try {
      const res = await fetch(`${API_URL}/sales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, total_amount })
      });
      if (res.ok) {
        alert("Checkout successful!");
        printReceipt();
        setPosCart([]);
        fetchMedicines(); // refresh inventory
      } else {
        alert("Checkout failed");
      }
    } catch (err) {
      alert("Error completing checkout.");
    }
  };

  const handleAIScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const result = await Tesseract.recognize(file, 'eng');
      const text = result.data.text.toLowerCase();

      // Attempt to find a matching medicine in inventory based on OCR text
      const matchedMeds = medicines.filter(m => text.includes(m.name.toLowerCase()));
      if (matchedMeds.length > 0) {
        // Pick the best match or just the first matched item
        const med = matchedMeds[0];
        addToPosCart(med);
        alert(`AI scanned and identified: ${med.name}`);
      } else {
        alert("AI scanner couldn't find a matching medicine in your inventory based on the image.");
      }
    } catch (err) {
      console.error("OCR Error", err);
      alert("Error scanning image");
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const printReceipt = () => {
    // We will trigger a print that only shows the #printable-receipt element
    window.print();
  };

  // --- Helpers ---
  const getStatusInfo = (med: Medicine) => {
    const expiry = new Date(med.expiry_date);
    const now = new Date();
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: "Expired", class: "badge-danger" };
    if (diffDays <= 90) return { label: "Expiring Soon", class: "badge-warning" };
    if (med.quantity === 0) return { label: "Out of Stock", class: "badge-danger" };
    if (med.quantity < 20) return { label: "Low Stock", class: "badge-warning" };
    return { label: "In Stock", class: "badge-success" };
  };

  const filteredMedicines = useMemo(() => {
    return medicines.filter((m: Medicine) => m.name.toLowerCase().includes(search.toLowerCase()) || m.category.toLowerCase().includes(search.toLowerCase()));
  }, [medicines, search]);

  const posFilteredMedicines = useMemo(() => {
    if (!posSearch) return [];
    return medicines.filter((m: Medicine) => (m.name.toLowerCase().includes(posSearch.toLowerCase()) || m.id.toString() === posSearch) && m.quantity > 0).slice(0, 5);
  }, [medicines, posSearch]);

  const totalValue = medicines.reduce((sum: number, med: Medicine) => sum + (med.quantity * Number(med.price)), 0);
  const expiringSoonCount = medicines.filter((m: Medicine) => {
    const d = new Date(m.expiry_date);
    return Math.ceil((d.getTime() - Date.now()) / 86400000) <= 90 && Math.ceil((d.getTime() - Date.now()) / 86400000) >= 0;
  }).length;

  // --- RENDER AUTH SCREEN ---
  if (!isAuthenticated) {
    return (
      <div className="auth-container">
        <div className="auth-box">
          <div className="auth-logo" style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--primary)', fontWeight: 'bold' }}>
            <HeartPulse size={40} /> MedShop Pro
          </div>
          <h2>{adminSetupRequired ? "Welcome! Let's Setup" : "Admin Login"}</h2>
          <p className="auth-subtitle">
            {adminSetupRequired ? "No admin found. Create your master account." : "Enter your credentials to manage inventory"}
          </p>

          <form className="modern-form" style={{ padding: 0 }} onSubmit={adminSetupRequired ? handleInitialSetup : handleLogin}>
            <div className="form-group">
              <label>Admin Username</label>
              <input type="text" value={adminUsername} onChange={e => setAdminUsername(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} required />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem', padding: '14px' }}>
              {adminSetupRequired ? "Register Master Admin" : "Log In securely"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- RENDER MAIN LAYOUT ---
  return (
    <>
      <div className="app-container">
        {/* Sidebar Navigation */}
        <aside className="sidebar">
          <div className="logo">
            <HeartPulse size={28} /> MedShop
          </div>
          <ul className="nav-menu">
            <li className={`nav-item ${activeTab === "inventory" ? "active" : ""}`} onClick={() => setActiveTab("inventory")}>
              <Pill className="nav-icon" size={20} /> Inventory
            </li>
            <li className={`nav-item ${activeTab === "pos" ? "active" : ""}`} onClick={() => setActiveTab("pos")}>
              <ShoppingCart className="nav-icon" size={20} /> Point of Sale
            </li>
            <li className={`nav-item ${activeTab === "suppliers" ? "active" : ""}`} onClick={() => setActiveTab("suppliers")}>
              <Users className="nav-icon" size={20} /> Suppliers
            </li>
            <li className={`nav-item ${activeTab === "reports" ? "active" : ""}`} onClick={() => setActiveTab("reports")}>
              <Activity className="nav-icon" size={20} /> Reports
            </li>
            <li className={`nav-item ${activeTab === "settings" ? "active" : ""}`} onClick={() => setActiveTab("settings")}>
              <Settings className="nav-icon" size={20} /> Settings
            </li>
          </ul>
        </aside>

        {/* Main Content Area */}
        <main className="main-content">
          <header className="header">
            <div className="welcome-text">
              <h1>{activeTab === 'inventory' ? 'Inventory Database' : activeTab === 'pos' ? 'Terminal Checkout' : activeTab === 'suppliers' ? 'Supplier Directory' : activeTab === 'reports' ? 'Analytics' : 'System Settings'}</h1>
              <p className="subtitle">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <div className="header-actions">
              <button
                className="btn-secondary"
                style={{ padding: '8px', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => setIsDarkMode(!isDarkMode)}
                title="Toggle Dark Mode"
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <div className="user-profile">
                <div className="avatar">{loggedInUser.charAt(0).toUpperCase()}</div>
                <span>{loggedInUser}</span>
              </div>
            </div>
          </header>

          {/* TAB: INVENTORY */}
          {activeTab === "inventory" && (
            <section className="inventory-section">
              <div className="section-header">
                <div className="search-box">
                  <Search className="search-icon" size={18} />
                  <input
                    type="text"
                    placeholder="Search medicines by name or category..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    ref={fileInputRef}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setIsScanning(true);
                      try {
                        const result = await Tesseract.recognize(file, 'eng');
                        const textLines = result.data.text.split('\n').filter(Boolean);

                        // Open modal immediately and pre-fill likely name text
                        openAddModal();
                        setFormData(prev => ({
                          ...prev,
                          name: textLines.length > 0 ? textLines[0].substring(0, 30) : "Scanned Medicine"
                        }));
                        alert("OCR Scanned text. Please review and fill in remaining details (stock, price, expiry).");
                      } catch (err) {
                        console.error("OCR Error", err);
                        alert("Error extracting text from image");
                      } finally {
                        setIsScanning(false);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }
                    }}
                  />
                  <button
                    className="btn-secondary"
                    onClick={() => fileInputRef.current?.click()}
                    title="Scan using Camera/AI"
                    disabled={isScanning}
                  >
                    {isScanning ? <Loader2 className="animate-pulse" size={18} /> : <span><Camera size={18} /> Scan Medicine</span>}
                  </button>
                  <button className="btn-primary" onClick={openAddModal}>
                    <Plus size={18} /> Register Medicine
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="loader"><Activity className="animate-pulse" /> Syncing database...</div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Medicine Name</th>
                        <th>Category</th>
                        <th>Stock Info</th>
                        <th>Price</th>
                        <th>Expiry</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMedicines.map((med) => {
                        const status = getStatusInfo(med);
                        const supplier = suppliers.find(s => s.id === med.supplier_id);
                        return (
                          <tr key={med.id}>
                            <td>
                              <div className="medicine-name">{med.name}</div>
                              {supplier && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Suppler: {supplier.name}</div>}
                            </td>
                            <td><span className="category-pill">{med.category || 'General'}</span></td>
                            <td>
                              <strong className={med.quantity < 20 ? "text-danger" : ""} style={{ fontSize: '1.1rem' }}>{med.quantity}</strong> units
                            </td>
                            <td style={{ fontWeight: 600 }}>₹{Number(med.price).toFixed(2)}</td>
                            <td>{new Date(med.expiry_date).toLocaleDateString()}</td>
                            <td><span className={`badge ${status.class}`}>{status.label}</span></td>
                            <td className="actions-cell">
                              <button className="btn-action btn-edit" onClick={() => openEditModal(med)} title="Edit"><Edit3 size={18} /></button>
                              <button className="btn-action btn-delete" onClick={() => deleteMedicine(med.id)} title="Delete"><Trash2 size={18} /></button>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredMedicines.length === 0 && (
                        <tr>
                          <td colSpan={7} className="empty-state">
                            <FileText className="empty-icon" size={48} />
                            <p>No inventory records found.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* TAB: POINT OF SALE */}
          {activeTab === "pos" && (
            <div className="grid-2">
              <section className="inventory-section">
                <h2>Add to Cart</h2>
                <div className="search-box" style={{ width: '100%', margin: '1.5rem 0', display: 'flex', gap: '8px' }}>
                  <Search className="search-icon" size={18} style={{ left: '16px' }} />
                  <input
                    type="text"
                    placeholder="Scan barcode or type medicine name..."
                    style={{ width: '100%' }}
                    value={posSearch}
                    onChange={e => setPosSearch(e.target.value)}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    ref={fileInputRef}
                    onChange={handleAIScan}
                  />
                  <button
                    className="btn-secondary"
                    onClick={() => fileInputRef.current?.click()}
                    title="Scan using Camera/AI"
                    disabled={isScanning}
                  >
                    {isScanning ? <Loader2 className="animate-pulse" size={18} /> : <Camera size={18} />}
                  </button>
                </div>

                <div className="search-results" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {posFilteredMedicines.map(med => (
                    <div key={med.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid var(--border-light)', borderRadius: '12px' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{med.name}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Stock: {med.quantity} | ₹{med.price}</div>
                      </div>
                      <button className="btn-primary" onClick={() => addToPosCart(med)} style={{ padding: '8px 16px', borderRadius: '8px' }}>
                        Add <ShoppingCart size={16} />
                      </button>
                    </div>
                  ))}
                  {posSearch && posFilteredMedicines.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No available items found.</div>
                  )}
                </div>
              </section>

              <section className="inventory-section" style={{ background: 'var(--primary)', color: 'white', display: 'flex', flexDirection: 'column' }}>
                <h2 style={{ color: 'white', marginBottom: '1.5rem' }}>Current Bill</h2>
                <div style={{ flexGrow: 1, overflowY: 'auto', background: 'rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                  {posCart.length === 0 ? (
                    <div style={{ textAlign: 'center', opacity: 0.8, marginTop: '2rem' }}>Cart is currently empty.</div>
                  ) : (
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {posCart.map(item => (
                        <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '10px' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{item.name}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', opacity: 0.9 }}>
                              <button
                                onClick={() => updateCartQuantity(item.id, item.cartQuantity - 1)}
                                disabled={item.cartQuantity <= 1}
                                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '6px', width: '24px', height: '24px', cursor: 'pointer', fontWeight: 700, fontSize: '1rem' }}
                              >-</button>
                              <span style={{ minWidth: '22px', textAlign: 'center', fontWeight: 700 }}>{item.cartQuantity}</span>
                              <button
                                onClick={() => updateCartQuantity(item.id, item.cartQuantity + 1)}
                                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '6px', width: '24px', height: '24px', cursor: 'pointer', fontWeight: 700, fontSize: '1rem' }}
                              >+</button>
                              <span>x ₹{item.price}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <strong>₹{(item.cartQuantity * Number(item.price)).toFixed(2)}</strong>
                            <button onClick={() => removeFromPosCart(item.id)} style={{ background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer' }}><X size={18} /></button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div style={{ borderTop: '2px solid rgba(255,255,255,0.2)', paddingTop: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>
                    <span>Total Due:</span>
                    <span>₹{posCart.reduce((sum, item) => sum + (item.cartQuantity * Number(item.price)), 0).toFixed(2)}</span>
                  </div>
                  <button
                    onClick={handleCheckout}
                    disabled={posCart.length === 0}
                    style={{ width: '100%', padding: '16px', background: 'white', color: 'var(--primary)', border: 'none', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 700, cursor: posCart.length ? 'pointer' : 'not-allowed', opacity: posCart.length ? 1 : 0.7 }}
                  >
                    <CheckCircle2 size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                    Process Payment & Print
                  </button>
                </div>
              </section>
            </div>
          )}

          {/* TAB: SUPPLIERS */}
          {activeTab === "suppliers" && (
            <section className="inventory-section">
              <div className="section-header">
                <h2>Authorized Suppliers</h2>
                <button className="btn-primary" onClick={() => { setSupplierFormData({ name: '', contact_number: '', email: '', address: '' }); setShowSupplierModal(true); }}>
                  <Plus size={18} /> Add Supplier
                </button>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Company Name</th>
                      <th>Contact</th>
                      <th>Email</th>
                      <th>Address</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map((sup: Supplier) => (
                      <tr key={sup.id}>
                        <td style={{ fontWeight: 600 }}>{sup.name}</td>
                        <td>{sup.contact_number}</td>
                        <td>{sup.email}</td>
                        <td>{sup.address}</td>
                        <td className="actions-cell">
                          <button className="btn-action btn-delete" onClick={() => deleteSupplier(sup.id)}><Trash2 size={18} /></button>
                        </td>
                      </tr>
                    ))}
                    {suppliers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="empty-state">No suppliers registered.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* TAB: REPORTS */}
          {activeTab === "reports" && (
            <section className="reports-section">
              <div className="stats-grid">
                <div className="stat-card blue">
                  <div className="icon-wrapper"><Pill size={28} /></div>
                  <div><div className="label">Total Varieties</div><div className="value">{medicines.length}</div></div>
                </div>
                <div className="stat-card green">
                  <div className="icon-wrapper">₹</div>
                  <div><div className="label">Total Value</div><div className="value">₹{totalValue.toLocaleString()}</div></div>
                </div>
                <div className="stat-card warning">
                  <div className="icon-wrapper"><ShieldAlert size={28} /></div>
                  <div><div className="label">Expiring ≤ 90 Days</div><div className="value">{expiringSoonCount}</div></div>
                </div>
                <div className="stat-card danger">
                  <div className="icon-wrapper"><Activity size={28} /></div>
                  <div><div className="label">Out of Stock</div><div className="value">{medicines.filter(m => m.quantity === 0).length}</div></div>
                </div>
              </div>

              <section className="inventory-section">
                <h3>Recent Sales Overview</h3>
                <p className="subtitle">Realtime fetching of total sales volumes goes here.</p>
                {/* Could fetch and display /sales data here, keeping UI simple for now */}
              </section>
            </section>
          )}

          {/* TAB: SETTINGS */}
          {activeTab === "settings" && (
            <section className="inventory-section">
              <h2>System Preferences</h2>
              <div style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid var(--border-light)', borderRadius: '16px', maxWidth: '600px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '2rem' }}>
                  <div className="avatar" style={{ width: '64px', height: '64px', fontSize: '1.5rem' }}>
                    {loggedInUser.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 style={{ margin: 0 }}>{loggedInUser}</h3>
                    <p className="subtitle">Master Administrator</p>
                  </div>
                </div>
                <button
                  className="btn-secondary"
                  style={{ borderColor: 'var(--danger)', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}
                  onClick={handleLogout}
                >
                  <LogOut size={18} /> Terminate Session
                </button>
              </div>
            </section>
          )}

        </main>

        {/* MODAL: Medicine */}
        {showModal && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <h2>{isEditing ? "Modify Drug Entry" : "Register Pharmaceutical"}</h2>
                <button className="btn-close" onClick={() => setShowModal(false)}><X size={24} /></button>
              </div>
              <form onSubmit={saveMedicine} className="modern-form">
                <div className="form-group">
                  <label>Medicine Definition</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} required placeholder="e.g. Paracetamol 500mg" />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Classification</label>
                    <select name="category" value={formData.category} onChange={handleInputChange}>
                      <option value="Tablets">Tablets</option>
                      <option value="Syrups">Syrups</option>
                      <option value="Injections">Injections</option>
                      <option value="Ointments">Ointments</option>
                      <option value="First Aid">First Aid</option>
                      <option value="General">General</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Unit Price (₹)</label>
                    <input type="number" name="price" value={formData.price} onChange={handleInputChange} required min="0" step="0.01" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Stock Count</label>
                    <input type="number" name="quantity" value={formData.quantity} onChange={handleInputChange} required min="0" />
                  </div>
                  <div className="form-group">
                    <label>Expiry Date</label>
                    <input type="date" name="expiry_date" value={formData.expiry_date} onChange={handleInputChange} required />
                  </div>
                </div>

                <div className="form-group">
                  <label>Authorized Supplier (Optional)</label>
                  <select name="supplier_id" value={formData.supplier_id} onChange={handleInputChange}>
                    <option value="">-- No Primary Supplier --</option>
                    {suppliers.map(sup => (
                      <option key={sup.id} value={sup.id}>{sup.name}</option>
                    ))}
                  </select>
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">
                    {isEditing ? "Save Adjustments" : "Add to Database"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Supplier */}
        {showSupplierModal && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <h2>Register New Supplier</h2>
                <button className="btn-close" onClick={() => setShowSupplierModal(false)}><X size={24} /></button>
              </div>
              <form onSubmit={saveSupplier} className="modern-form">
                <div className="form-group">
                  <label>Company Name</label>
                  <input type="text" value={supplierFormData.name} onChange={e => setSupplierFormData({ ...supplierFormData, name: e.target.value })} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Contact Number</label>
                    <input type="text" value={supplierFormData.contact_number} onChange={e => setSupplierFormData({ ...supplierFormData, contact_number: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Email Address</label>
                    <input type="email" value={supplierFormData.email} onChange={e => setSupplierFormData({ ...supplierFormData, email: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Physical Address</label>
                  <input type="text" value={supplierFormData.address} onChange={e => setSupplierFormData({ ...supplierFormData, address: e.target.value })} />
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowSupplierModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Register Supplier</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>

      {/* --- INVISIBLE PRINTABLE RECEIPT FOR JAISWAL MEDICAL BARAD --- */}
      <div id="printable-receipt" className="print-only">
        <div className="receipt-header">
          <h2>JAISWAL MEDICAL BARAD</h2>
          <p>Nanded-Bhokar Road, Beside Barad main Kaman, Barad</p>
          <p>Phone: +91 9842901919</p>
          <div className="receipt-divider"></div>
          <p>Date: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
          <p>Invoice #: {Math.floor(Math.random() * 1000000)}</p>
        </div>
        <div className="receipt-divider"></div>
        <table className="receipt-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {posCart.map(item => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.cartQuantity}</td>
                <td>₹{Number(item.price).toFixed(2)}</td>
                <td>₹{(item.cartQuantity * Number(item.price)).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="receipt-divider"></div>
        <div className="receipt-total">
          <strong>TOTAL:</strong>
          <strong>
            ₹{posCart.reduce((sum, item) => sum + (item.cartQuantity * Number(item.price)), 0).toFixed(2)}
          </strong>
        </div>
        <div className="receipt-divider"></div>
        <div className="receipt-footer">
          <p>Thank you for your visit!</p>
          <p>Get Well Soon</p>
          <p>This website is developed and managed by Prakash-Pawar</p>
        </div>
      </div>
    </>
  );
}
