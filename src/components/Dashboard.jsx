import { useEffect, useState } from 'react';
import Chart from 'react-apexcharts';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChartBar, faUsers, faBars, faXmark, faChartLine,
  faMobileScreenButton, faDesktop, faGlobe, faChartPie,
  faDownload, faRightFromBracket, faShareNodes, faPercent, faTrophy,
  faMagnifyingGlass, faKey, faSliders
} from '@fortawesome/free-solid-svg-icons';

/* ── helpers ── */
function toDate(val) {
  if (!val) return new Date();
  if (val.toDate) return val.toDate(); // Firestore Timestamp
  if (typeof val === 'string') return new Date(val);
  if (typeof val === 'number') return new Date(val);
  return new Date();
}

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function detectDevice(info) {
  if (!info) return 'Unknown';
  const s = info.toLowerCase();
  if (/mobile|iphone|android.*mobile|phone/i.test(s)) return 'Mobile';
  if (/tablet|ipad/i.test(s)) return 'Tablet';
  if (/windows|macintosh|mac os|linux.*x86|cros/i.test(s)) return 'Desktop';
  return 'Other';
}

function detectBrowser(info) {
  if (!info) return 'Unknown';
  const s = info.toLowerCase();
  if (s.includes('edg/')) return 'Edge';
  if (s.includes('chrome') || s.includes('chromium')) return 'Chrome';
  if (s.includes('safari') && !s.includes('chrome')) return 'Safari';
  if (s.includes('firefox')) return 'Firefox';
  if (s.includes('opr/') || s.includes('opera')) return 'Opera';
  return 'Other';
}

function detectOS(info) {
  if (!info) return 'Unknown';
  const s = info.toLowerCase();
  if (s.includes('windows')) return 'Windows';
  if (s.includes('macintosh') || s.includes('mac os') || s.includes('intel mac')) return 'macOS';
  if (s.includes('iphone') || s.includes('ipad') || s.includes('ipod')) return 'iOS';
  if (s.includes('android')) return 'Android';
  if (s.includes('linux')) return 'Linux';
  return 'Other';
}

/* ── light mode chart theme ── */
const chartTheme = {
  chart: {
    background: 'transparent',
    foreColor: '#64748B',
    toolbar: { show: false },
    fontFamily: 'Outfit, sans-serif',
  },
  grid: {
    borderColor: '#E2E8F0',
    strokeDashArray: 4,
  },
  tooltip: {
    theme: 'light',
    style: { fontFamily: 'Outfit, sans-serif' },
  },
  dataLabels: { enabled: false },
};

function Dashboard() {
  const location = useLocation();
  const [waitlist, setWaitlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'overview'); // 'overview' | 'users' | 'referral'
  
  // DataTable pagination & search states
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const snap = await getDocs(collection(db, 'waitlist'));
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setWaitlist(data);
      } catch (err) {
        console.error('Error fetching waitlist:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // CSV download function
  const downloadCSV = () => {
    if (waitlist.length === 0) return;
    const headers = ['Name', 'Email', 'Registration Date', 'Country', 'Device Category', 'OS', 'Browser', 'User Agent', 'My Referral Code', 'Referred By'];
    const rows = waitlist.map(item => {
      const name = (item.name || item.firstName || item.displayName || '').replace(/"/g, '""');
      const regDate = fmtDate(toDate(item.createdAt));
      const deviceCat = detectDevice(item.deviceInfo);
      const os = detectOS(item.deviceInfo);
      const browser = detectBrowser(item.deviceInfo);
      const email = item.email || '';
      const country = item.geoCountry || item.country || '';
      const ua = (item.deviceInfo || '').replace(/"/g, '""');
      const myRef = item.referralCode || '';
      const refBy = item.referredBy || '';
      return [
        `"${name}"`,
        `"${email}"`,
        `"${regDate}"`,
        `"${country}"`,
        `"${deviceCat}"`,
        `"${os}"`,
        `"${browser}"`,
        `"${ua}"`,
        `"${myRef}"`,
        `"${refBy}"`
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reviel_waitlist_export_${fmtDate(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          Loading analytics…
        </p>
      </div>
    );
  }

  /* ── Compute analytics ── */
  const total = waitlist.length;

  // Build lookup: code -> owner info
  const codeOwnerMap = {};
  waitlist.forEach((item) => {
    if (item.referralCode) {
      const code = item.referralCode.trim();
      if (code) {
        codeOwnerMap[code] = {
          name: item.name || item.firstName || item.displayName || '',
          email: item.email || '',
        };
      }
    }
  });

  // Referral breakdown calculations using referredBy
  let referralTotalCount = 0;
  const refCounts = {};
  const refCodeUsers = {};

  waitlist.forEach((item) => {
    if (item.referredBy) {
      const code = item.referredBy.trim();
      if (code) {
        refCounts[code] = (refCounts[code] || 0) + 1;
        referralTotalCount++;
        
        if (!refCodeUsers[code]) refCodeUsers[code] = [];
        refCodeUsers[code].push({
          name: item.name || item.firstName || item.displayName || '',
          email: item.email || '',
        });
      }
    }
  });

  const referralRate = total > 0 ? ((referralTotalCount / total) * 100).toFixed(1) : 0;
  const directTotalCount = total - referralTotalCount;
  const directRate = total > 0 ? ((directTotalCount / total) * 100).toFixed(1) : 0;

  const sortedRefs = Object.entries(refCounts).sort((a, b) => b[1] - a[1]);
  const topRefs = sortedRefs.slice(0, 10);
  const activeReferralCodesCount = Object.keys(refCounts).length;
  const avgReferralsPerCode = activeReferralCodesCount > 0 
    ? (referralTotalCount / activeReferralCodesCount).toFixed(1)
    : 0;


  // Daily signups split & Cumulative compounding calculation
  const dailyCounts = {};
  const dailyReferredCounts = {};
  const dailyOrganicCounts = {};

  waitlist.forEach((item) => {
    const date = fmtDate(toDate(item.createdAt));
    dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    if (item.referredBy) {
      dailyReferredCounts[date] = (dailyReferredCounts[date] || 0) + 1;
    } else {
      dailyOrganicCounts[date] = (dailyOrganicCounts[date] || 0) + 1;
    }
  });

  const sortedDates = Object.keys(dailyCounts).sort();
  const cumulativeSeriesData = [];
  let runningSum = 0;
  sortedDates.forEach((d) => {
    runningSum += dailyCounts[d];
    cumulativeSeriesData.push(runningSum);
  });

  // Device type breakdown
  const deviceCounts = {};
  const osCounts = {};
  const browserCounts = {};

  waitlist.forEach((item) => {
    const info = item.deviceInfo;
    const device = detectDevice(info);
    const os = detectOS(info);
    const browser = detectBrowser(info);

    deviceCounts[device] = (deviceCounts[device] || 0) + 1;
    osCounts[os] = (osCounts[os] || 0) + 1;
    browserCounts[browser] = (browserCounts[browser] || 0) + 1;
  });

  // Geo breakdown
  const geoCounts = {};
  waitlist.forEach((item) => {
    const country = item.geoCountry || item.country || 'Unknown';
    geoCounts[country] = (geoCounts[country] || 0) + 1;
  });
  const topCountries = Object.entries(geoCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  /* ── Chart configs ── */

  // COMPACTION GROWTH (Compounding Time Series) - Full Width
  const compoundingGrowthOptions = {
    ...chartTheme,
    chart: { ...chartTheme.chart, id: 'cumulative-growth', type: 'area' },
    xaxis: {
      categories: sortedDates,
      labels: {
        style: { colors: '#64748B', fontSize: '11px' },
        rotate: -45,
        rotateAlways: sortedDates.length > 10,
        formatter: (val) => val ? val.slice(5) : '',
      },
    },
    yaxis: { labels: { style: { colors: '#64748B' } } },
    stroke: { curve: 'smooth', width: 3 },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [0, 100],
        colorStops: [
          { offset: 0, color: '#3c627d', opacity: 0.4 },
          { offset: 100, color: '#3c627d', opacity: 0 },
        ],
      },
    },
    colors: ['#3c627d'],
  };

  const compoundingGrowthSeries = [
    { name: 'Compounded Signups', data: cumulativeSeriesData },
  ];

  // Daily Organic vs Referred chart options
  const dailySplitOptions = {
    ...chartTheme,
    chart: { ...chartTheme.chart, id: 'daily-split', type: 'area' },
    xaxis: {
      categories: sortedDates,
      labels: {
        style: { colors: '#64748B', fontSize: '11px' },
        rotate: -45,
        formatter: (val) => val ? val.slice(5) : '',
      },
    },
    yaxis: { labels: { style: { colors: '#64748B' } } },
    stroke: { curve: 'smooth', width: 2.5 },
    colors: ['#3B82F6', '#10B981'],
    legend: { position: 'top', horizontalAlign: 'right', labels: { colors: '#64748B' } },
  };

  const dailySplitSeries = [
    { name: 'Organic Signups', data: sortedDates.map((d) => dailyOrganicCounts[d] || 0) },
    { name: 'Referred Signups', data: sortedDates.map((d) => dailyReferredCounts[d] || 0) },
  ];

  // Referral vs Organic share donut options
  const referralShareOptions = {
    ...chartTheme,
    labels: ['Direct / Organic', 'Via Referral Code'],
    colors: ['#3B82F6', '#10B981'],
    legend: { position: 'bottom', labels: { colors: '#64748B' } },
    stroke: { show: false },
    plotOptions: {
      pie: {
        donut: { size: '60%', labels: { show: true, total: { show: true, label: 'Conversion', color: '#64748B' } } },
      },
    },
  };

  const referralShareSeries = [directTotalCount, referralTotalCount];

  // Device Category Share Donut
  const deviceShareOptions = {
    ...chartTheme,
    labels: Object.keys(deviceCounts),
    colors: ['#3c627d', '#10B981', '#F59E0B', '#3B82F6', '#EF4444'],
    legend: { position: 'bottom', labels: { colors: '#64748B' } },
    stroke: { show: false },
    plotOptions: {
      pie: {
        donut: { size: '60%', labels: { show: true, total: { show: true, label: 'Devices', color: '#64748B' } } },
      },
    },
  };
  const deviceShareSeries = Object.values(deviceCounts);

  // OS Share Donut
  const osShareOptions = {
    ...chartTheme,
    labels: Object.keys(osCounts),
    colors: ['#3c627d', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'],
    legend: { position: 'bottom', labels: { colors: '#64748B' } },
    stroke: { show: false },
    plotOptions: {
      pie: {
        donut: { size: '60%', labels: { show: true, total: { show: true, label: 'Operating Systems', color: '#64748B' } } },
      },
    },
  };
  const osShareSeries = Object.values(osCounts);

  // Browser breakdown Bar Chart
  const browserBarOptions = {
    ...chartTheme,
    chart: { ...chartTheme.chart, id: 'browser-bar', type: 'bar' },
    xaxis: {
      categories: Object.keys(browserCounts),
      labels: { style: { colors: '#64748B', fontSize: '11px' } },
    },
    yaxis: { labels: { style: { colors: '#64748B' } } },
    colors: ['#3c627d'],
    plotOptions: {
      bar: {
        borderRadius: 5,
        columnWidth: '45%',
        distributed: true,
      },
    },
    legend: { show: false },
  };
  const browserBarSeries = [
    { name: 'Users', data: Object.values(browserCounts) },
  ];

  // Top Referral Codes Bar Chart (top 10 with rich hover tooltip)
  const refBarOptions = {
    ...chartTheme,
    chart: { ...chartTheme.chart, id: 'ref-bar', type: 'bar' },
    xaxis: {
      categories: topRefs.map((c) => c[0]),
      labels: { style: { colors: '#64748B', fontSize: '11px' } },
    },
    yaxis: { labels: { style: { colors: '#64748B' } } },
    colors: ['#10B981'],
    plotOptions: {
      bar: {
        borderRadius: 5,
        columnWidth: '50%',
        distributed: true,
      },
    },
    legend: { show: false },
    tooltip: {
      custom: ({ series, seriesIndex, dataPointIndex, w }) => {
        const code = w.globals.labels[dataPointIndex];
        const count = series[seriesIndex][dataPointIndex];
        const owner = codeOwnerMap[code];
        const ownerHtml = owner
          ? `<div style="font-size:0.78rem;color:#4B5563;margin-bottom:8px;padding-bottom:6px;border-bottom:1px dashed #E2E8F0;">
              Shared by: <strong style="color:#1F2937;">${owner.name}</strong>
             </div>`
          : `<div style="font-size:0.78rem;color:#9CA3AF;margin-bottom:8px;padding-bottom:6px;border-bottom:1px dashed #E2E8F0;font-style:italic;">
              Unknown owner
             </div>`;
        const users = refCodeUsers[code] || [];
        const shown = users.slice(0, 6);
        const extra = users.length - shown.length;
        const rows = shown.map((u) => {
          const name = u.name || '<em style="opacity:0.5">No name</em>';
          const email = u.email || '—';
          return `<div style="display:flex;flex-direction:column;padding:4px 0;border-bottom:1px solid #F1F5F9;">
            <span style="font-weight:600;color:#1E293B;font-size:0.8rem;">${name}</span>
            <span style="color:#64748B;font-size:0.74rem;">${email}</span>
          </div>`;
        }).join('');
        return `<div style="font-family:'Outfit',sans-serif;padding:14px 16px;min-width:240px;max-width:320px;border-radius:10px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <span style="font-weight:700;color:#1E293B;font-size:0.9rem;"><svg aria-hidden="true" focusable="false" viewBox="0 0 576 512" style="width:14px;height:14px;fill:#F59E0B;margin-right:4px;display:inline-block;vertical-align:middle;"><path d="M400 96h48v96c0 12.12-2.9 23.55-8 33.64C428.3 203.2 400 172.9 400 136V96zM128 192V96h48v40c0 36.9-28.3 67.2-40 89.64C130.9 215.6 128 204.1 128 192zM0 128c0 40.59 23.38 75.75 57 92.83C81.87 266.3 124 288 124 288H192c0 23.01 10.02 43.68 26 58v18H176c-30.88 0-56 25.12-56 56v32c0 13.25 10.75 24 24 24h288c13.25 0 24-10.75 24-24v-32c0-30.88-25.12-56-56-56h-42v-18c15.98-14.32 26-34.99 26-58h68s42.13-21.7 67-67.17c33.62-17.08 57-52.24 57-92.83 0-53.02-42.98-96-96-96h-64C416 16 384 0 352 0H224C192 0 160 16 128 32H64C30.98 32 0 74.98 0 128z"></path></svg> ${code}</span>
            <span style="background:#D1FAE5;color:#059669;font-size:0.75rem;font-weight:700;padding:2px 8px;border-radius:20px;">${count} invite${count !== 1 ? 's' : ''}</span>
          </div>
          ${ownerHtml}
          <div style="font-weight:600;color:#64748B;font-size:0.76rem;text-transform:uppercase;margin-top:6px;margin-bottom:4px;">Referred Signups:</div>
          ${rows || '<div style="font-style:italic;color:#9CA3AF;font-size:0.76rem;padding:4px 0;">No details</div>'}
          ${extra > 0 ? `<div style="color:#64748B;font-size:0.76rem;margin-top:8px;">+ ${extra} more</div>` : ''}
        </div>`;
      },
    },
  };
  const refBarSeries = [
    { name: 'Invites', data: topRefs.map((c) => c[1]) },
  ];

  const todayStr = fmtDate(new Date());
  const todayCount = dailyCounts[todayStr] || 0;
  const todayReferred = dailyReferredCounts[todayStr] || 0;

  // Filtered directory user lists
  const filteredWaitlist = waitlist.filter((item) => {
    const q = searchQuery.toLowerCase();
    const email = (item.email || '').toLowerCase();
    const country = (item.geoCountry || item.country || '').toLowerCase();
    const refCode = (item.referralCode || '').toLowerCase();
    const refBy = (item.referredBy || '').toLowerCase();
    const devInfo = (item.deviceInfo || '').toLowerCase();
    
    return email.includes(q) || country.includes(q) || refCode.includes(q) || refBy.includes(q) || devInfo.includes(q);
  });

  // Pagination bounds
  const totalItems = filteredWaitlist.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const currentItems = filteredWaitlist.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handlePageChange = (p) => {
    if (p >= 1 && p <= totalPages) {
      setCurrentPage(p);
    }
  };

  return (
    <div className="dashboard">
      {/* Sticky Desktop Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src="/logo_reviel.png" alt="Reviel Logo" />
        </div>
        <nav className="sidebar-menu">
          <button
            onClick={() => setActiveTab('overview')}
            className={`sidebar-menu-item ${activeTab === 'overview' ? 'active' : ''}`}
          >
            <FontAwesomeIcon icon={faChartBar} className="sidebar-icon" />
            Analytics Overview
          </button>
          <button
            onClick={() => {
              navigate('/referral');
              setMobileMenuOpen(false);
              setActiveTab('referral');
            }}
            className={`sidebar-menu-item ${activeTab === 'referral' ? 'active' : ''}`}
          >
            <FontAwesomeIcon icon={faTrophy} className="sidebar-icon" />
            Referral Leaderboard
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`sidebar-menu-item ${activeTab === 'users' ? 'active' : ''}`}
          >
            <FontAwesomeIcon icon={faUsers} className="sidebar-icon" />
            Waitlist Directory
          </button>
        </nav>
        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            <FontAwesomeIcon icon={faRightFromBracket} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Sticky Mobile Header */}
      <header className="mobile-header">
        <div className="logo" style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/logo_reviel.png" alt="Reviel Logo" />
        </div>
        <button className="hamburger-btn" onClick={() => setMobileMenuOpen(true)}>
          <FontAwesomeIcon icon={faBars} />
        </button>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <>
          <div className="mobile-drawer-overlay" onClick={() => setMobileMenuOpen(false)} />
          <div className="mobile-drawer">
            <div className="mobile-drawer-header">
              <img src="/logo_reviel.png" alt="Reviel Logo" />
              <button className="close-btn" onClick={() => setMobileMenuOpen(false)}>
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
            <nav className="sidebar-menu">
              <button
                onClick={() => {
                  setActiveTab('overview');
                  setMobileMenuOpen(false);
                }}
                className={`sidebar-menu-item ${activeTab === 'overview' ? 'active' : ''}`}
              >
                <FontAwesomeIcon icon={faChartBar} className="sidebar-icon" />
                Analytics Overview
              </button>
              <button
                onClick={() => {
                  navigate('/referral');
                  setMobileMenuOpen(false);
                }}
                className={`sidebar-menu-item ${activeTab === 'referral' ? 'active' : ''}`}
              >
                <FontAwesomeIcon icon={faTrophy} className="sidebar-icon" /> Referral Leaderboard
              </button>
              <button
                onClick={() => {
                  setActiveTab('users');
                  setMobileMenuOpen(false);
                }}
                className={`sidebar-menu-item ${activeTab === 'users' ? 'active' : ''}`}
              >
                <FontAwesomeIcon icon={faUsers} className="sidebar-icon" />
                Waitlist Directory
              </button>
            </nav>
            <div className="sidebar-footer">
              <button className="logout-btn" onClick={handleLogout}>
                <FontAwesomeIcon icon={faRightFromBracket} />
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}

      {/* Main Content Area */}
      <main className="dashboard-main">
        <div className="dashboard-content">
          <h1 className="dashboard-title fade-in">Waitlist Analytics</h1>
        <p className="dashboard-subtitle fade-in fade-in-delay-1">
          Real-time metrics, registration trends, and deep referral insights.
        </p>
        {activeTab === 'overview' ? (
          <div className="fade-in">
            {/* ── KPI Metric Cards ── */}
            <div className="metrics-grid">
              <div className="metric-card accent fade-in fade-in-delay-1">
                <div className="metric-icon"><FontAwesomeIcon icon={faUsers} /></div>
                <div className="metric-label">Total Signups</div>
                <div className="metric-value">{total.toLocaleString()}</div>
              </div>
              <div className="metric-card success fade-in fade-in-delay-2">
                <div className="metric-icon"><FontAwesomeIcon icon={faShareNodes} /></div>
                <div className="metric-label">Via Referral Code</div>
                <div className="metric-value">{referralTotalCount.toLocaleString()}</div>
              </div>
              <div className="metric-card info fade-in fade-in-delay-3">
                <div className="metric-icon"><FontAwesomeIcon icon={faPercent} /></div>
                <div className="metric-label">Referral Rate</div>
                <div className="metric-value">{referralRate}%</div>
              </div>
              <div className="metric-card accent fade-in fade-in-delay-4">
                <div className="metric-icon"><FontAwesomeIcon icon={faChartLine} /></div>
                <div className="metric-label">Signups Today</div>
                <div className="metric-value">{todayCount.toLocaleString()}</div>
              </div>
            </div>

            {/* ── Compounding Growth Chart (full width) ── */}
            <h2 className="section-title"><FontAwesomeIcon icon={faChartLine} /> Compounding Waitlist Growth</h2>
            <div className="chart-card fade-in" style={{ marginBottom: '32px' }}>
              {sortedDates.length > 0 ? (
                <Chart options={compoundingGrowthOptions} series={compoundingGrowthSeries} type="area" height={280} />
              ) : (
                <p style={{ color: 'var(--color-text-muted)' }}>No data yet</p>
              )}
            </div>



            {/* ── Referral & Device Charts ── */}
            <div className="charts-grid">
              <div>
                <h2 className="section-title"><FontAwesomeIcon icon={faChartPie} /> Acquisition Share</h2>
                <div className="chart-card fade-in">
                  {referralTotalCount > 0 || directTotalCount > 0 ? (
                    <Chart options={referralShareOptions} series={referralShareSeries} type="donut" height={280} />
                  ) : (
                    <p style={{ color: 'var(--color-text-muted)' }}>No data yet</p>
                  )}
                </div>
              </div>
              <div>
                <h2 className="section-title"><FontAwesomeIcon icon={faDesktop} /> Device Category</h2>
                <div className="chart-card fade-in">
                  {Object.keys(deviceCounts).length > 0 ? (
                    <Chart options={deviceShareOptions} series={deviceShareSeries} type="donut" height={280} />
                  ) : (
                    <p style={{ color: 'var(--color-text-muted)' }}>No data yet</p>
                  )}
                </div>
              </div>
              <div>
                <h2 className="section-title"><FontAwesomeIcon icon={faMobileScreenButton} /> Operating System</h2>
                <div className="chart-card fade-in">
                  {Object.keys(osCounts).length > 0 ? (
                    <Chart options={osShareOptions} series={osShareSeries} type="donut" height={280} />
                  ) : (
                    <p style={{ color: 'var(--color-text-muted)' }}>No data yet</p>
                  )}
                </div>
              </div>
              <div>
                <h2 className="section-title"><FontAwesomeIcon icon={faGlobe} /> Browser Breakdown</h2>
                <div className="chart-card fade-in">
                  {Object.keys(browserCounts).length > 0 ? (
                    <Chart options={browserBarOptions} series={browserBarSeries} type="bar" height={280} />
                  ) : (
                    <p style={{ color: 'var(--color-text-muted)' }}>No data yet</p>
                  )}
                </div>
              </div>
            </div>



            {/* ── Geographic Breakdown ── */}
            <h2 className="section-title"><FontAwesomeIcon icon={faGlobe} /> Top Countries</h2>
            <div className="chart-card fade-in" style={{ marginBottom: '32px' }}>
              {topCountries.length > 0 ? (
                <Chart
                  options={{
                    ...compoundingGrowthOptions,
                    chart: { ...compoundingGrowthOptions.chart, id: 'geo-bar', type: 'bar' },
                    xaxis: { categories: topCountries.map(c => c[0]), labels: { style: { colors: '#64748B', fontSize: '11px' } } },
                    colors: ['#3c627d'],
                    plotOptions: { bar: { borderRadius: 5, columnWidth: '50%', distributed: true } },
                    legend: { show: false },
                    tooltip: { theme: 'light' },
                  }}
                  series={[{ name: 'Signups', data: topCountries.map(c => c[1]) }]}
                  type="bar"
                  height={300}
                />
              ) : (
                <p style={{ color: 'var(--color-text-muted)' }}>No geographic data yet.</p>
              )}
            </div>
          </div>

          ) : activeTab === 'referral' ? (
            <div className="fade-in">
              <h1 className="dashboard-title"><FontAwesomeIcon icon={faTrophy} className="sidebar-icon" /> Referral Leaderboard</h1>
              <p className="dashboard-subtitle">Top performing invite codes and referral metrics</p>
              <div className="metrics-grid">
                <div className="metric-card accent fade-in fade-in-delay-1">
                  <div className="metric-icon"><FontAwesomeIcon icon={faUsers} /></div>
                  <div className="metric-label">Total Signups</div>
                  <div className="metric-value">{total.toLocaleString()}</div>
                </div>
                <div className="metric-card success fade-in fade-in-delay-2">
                  <div className="metric-icon"><FontAwesomeIcon icon={faShareNodes} /></div>
                  <div className="metric-label">Total Referred</div>
                  <div className="metric-value">{referralTotalCount.toLocaleString()}</div>
                </div>
                <div className="metric-card info fade-in fade-in-delay-4">
                  <div className="metric-icon"><FontAwesomeIcon icon={faPercent} /></div>
                  <div className="metric-label">Conversion Share</div>
                  <div className="metric-value">{referralRate}%</div>
                </div>
              </div>
              <h2 className="section-title"><FontAwesomeIcon icon={faChartPie} /> Waitlist Acquisition Share</h2>
              <div className="chart-card fade-in" style={{ marginBottom: '32px' }}>
                {referralTotalCount > 0 || directTotalCount > 0 ? (
                  <Chart options={referralShareOptions} series={referralShareSeries} type="donut" height={300} />
                ) : (
                  <p style={{ color: 'var(--color-text-muted)' }}>No data yet</p>
                )}
              </div>
              <h2 className="section-title"><FontAwesomeIcon icon={faTrophy} /> Top Referral Codes</h2>
              <div className="chart-card fade-in" style={{ marginBottom: '32px' }}>
                {topRefs.length > 0 ? (
                  <Chart options={refBarOptions} series={refBarSeries} type="bar" height={350} />
                ) : (
                  <p style={{ color: 'var(--color-text-muted)' }}>No referral codes yet.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="fade-in">
              {/* Search and Download Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', gap: '8px', flex: 1, maxWidth: '400px' }}>
                  <input 
                    type="text" 
                    placeholder="Search email, country, code, device..." 
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-sm)',
                      outline: 'none',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <select 
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: '10px 12px',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '0.9rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value={10}>Show 10 rows</option>
                    <option value={25}>Show 25 rows</option>
                    <option value={50}>Show 50 rows</option>
                    <option value={100}>Show 100 rows</option>
                  </select>

                  <button 
                    onClick={downloadCSV}
                    style={{
                      padding: '10px 20px',
                      background: 'var(--color-accent)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'var(--transition)'
                    }}
                    className="download-btn"
                  >
                    <FontAwesomeIcon icon={faDownload} /> Export CSV
                  </button>
                </div>
              </div>

              {/* Waitlist Directory Paginated Table */}
              <div className="table-card" style={{ padding: '0px', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ margin: '0' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '16px' }}>Name</th>
                        <th>Email Address</th>
                        <th>Registration Date</th>
                        <th>Country</th>
                        <th>Device Type</th>
                        <th>Browser</th>
                        <th>Operating System</th>
                        <th>Referral Code</th>
                        <th>Invite Code Used</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentItems.length > 0 ? (
                        currentItems.map((item) => {
                          const deviceType = detectDevice(item.deviceInfo);
                          const os = detectOS(item.deviceInfo);
                          const browser = detectBrowser(item.deviceInfo);
                          const fullName = item.name || item.firstName || item.displayName || '—';
                          return (
                            <tr key={item.id}>
                              <td style={{ padding: '16px', fontWeight: 600, color: 'var(--color-dark)' }}>{fullName}</td>
                              <td style={{ fontWeight: 500 }}>{item.email || '—'}</td>
                              <td style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                                {fmtDate(toDate(item.createdAt))}
                              </td>
                              <td>{item.geoCountry || item.country || '—'}</td>
                              <td>
                                <span className={`badge ${deviceType.toLowerCase()}`}>{deviceType}</span>
                              </td>
                              <td>{browser}</td>
                              <td>{os}</td>
                              <td style={{ fontWeight: 500, color: 'var(--color-dark)', fontFamily: 'monospace' }}>
                                {item.referralCode || '—'}
                              </td>
                              <td style={{ fontWeight: item.referredBy ? 600 : 400, color: item.referredBy ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                                {item.referredBy || 'Direct Sign Up'}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="9" style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                            No results found matching your search query.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination controls footer */}
                {totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid var(--border-light)' }}>
                    <span style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
                      Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems} signups
                    </span>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        disabled={currentPage === 1}
                        onClick={() => handlePageChange(currentPage - 1)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid var(--border-light)',
                          borderRadius: 'var(--radius-sm)',
                          background: currentPage === 1 ? '#F1F5F9' : 'white',
                          color: currentPage === 1 ? '#94A3B8' : 'var(--color-text)',
                          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                          fontSize: '0.85rem'
                        }}
                      >
                        Previous
                      </button>
                      
                      {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                        .map((p, index, arr) => {
                          const showDots = index > 0 && p - arr[index - 1] > 1;
                          return (
                            <div key={p} style={{ display: 'flex', gap: '6px' }}>
                              {showDots && <span style={{ padding: '4px 8px', color: 'var(--color-text-muted)' }}>...</span>}
                              <button
                                onClick={() => handlePageChange(p)}
                                style={{
                                  padding: '6px 12px',
                                  border: '1px solid var(--border-light)',
                                  borderRadius: 'var(--radius-sm)',
                                  background: currentPage === p ? 'var(--color-accent)' : 'white',
                                  color: currentPage === p ? 'white' : 'var(--color-text)',
                                  cursor: 'pointer',
                                  fontSize: '0.85rem',
                                  fontWeight: currentPage === p ? 600 : 400
                                }}
                              >
                                {p}
                              </button>
                            </div>
                          );
                        })
                      }

                      <button
                        disabled={currentPage === totalPages}
                        onClick={() => handlePageChange(currentPage + 1)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid var(--border-light)',
                          borderRadius: 'var(--radius-sm)',
                          background: currentPage === totalPages ? '#F1F5F9' : 'white',
                          color: currentPage === totalPages ? '#94A3B8' : 'var(--color-text)',
                          cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                          fontSize: '0.85rem'
                        }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
