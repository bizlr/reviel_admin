import React, { useEffect, useState } from 'react';
import Chart from 'react-apexcharts';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTrophy, faChartBar, faShareNodes, faPercent, faChartPie,
  faBars, faXmark, faUsers, faRightFromBracket
} from '@fortawesome/free-solid-svg-icons';

/* Helper functions (same as Dashboard) */
function toDate(val) {
  if (!val) return new Date();
  if (val.toDate) return val.toDate();
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

const chartTheme = {
  chart: { background: 'transparent', foreColor: '#64748B', toolbar: { show: false }, fontFamily: 'Outfit, sans-serif' },
  grid: { borderColor: '#E2E8F0', strokeDashArray: 4 },
  tooltip: { theme: 'light', style: { fontFamily: 'Outfit, sans-serif' } },
  dataLabels: { enabled: false },
};

export default function ReferralLeaderboard() {
  const [waitlist, setWaitlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const snap = await getDocs(collection(db, 'waitlist'));
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setWaitlist(data);
      } catch (err) {
        console.error('Error fetching waitlist:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Loading referral leaderboard…</p>
      </div>
    );
  }

  // Compute analytics (same as Dashboard's referral section)
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

  waitlist.forEach(item => {
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
  const directTotalCount = total - referralTotalCount;
  const referralRate = total > 0 ? ((referralTotalCount / total) * 100).toFixed(1) : 0;
  const sortedRefs = Object.entries(refCounts).sort((a, b) => b[1] - a[1]);
  const topRefs = sortedRefs.slice(0, 10);

  // Referral Share Donut
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

  // Referral Bar Chart with rich tooltip
  const refBarOptions = {
    ...chartTheme,
    chart: { ...chartTheme.chart, id: 'ref-bar', type: 'bar' },
    xaxis: { categories: topRefs.map(c => c[0]), labels: { style: { colors: '#64748B', fontSize: '11px' } } },
    yaxis: { labels: { style: { colors: '#64748B' } } },
    colors: ['#10B981'],
    plotOptions: { bar: { borderRadius: 5, columnWidth: '50%', distributed: true } },
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
        const rows = shown.map(u => {
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
  const refBarSeries = [{ name: 'Invites', data: topRefs.map(c => c[1]) }];

  return (
    <div className="dashboard">
      {/* Sticky Desktop Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src="/logo_reviel.png" alt="Reviel Logo" />
        </div>
        <nav className="sidebar-menu">
          <button
            onClick={() => navigate('/dashboard', { state: { activeTab: 'overview' } })}
            className="sidebar-menu-item"
          >
            <FontAwesomeIcon icon={faChartBar} className="sidebar-icon" />
            Analytics Overview
          </button>
          <button
            onClick={() => {}}
            className="sidebar-menu-item active"
          >
            <FontAwesomeIcon icon={faTrophy} className="sidebar-icon" />
            Referral Leaderboard
          </button>
          <button
            onClick={() => navigate('/dashboard', { state: { activeTab: 'users' } })}
            className="sidebar-menu-item"
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
                  navigate('/dashboard', { state: { activeTab: 'overview' } });
                  setMobileMenuOpen(false);
                }}
                className="sidebar-menu-item"
              >
                <FontAwesomeIcon icon={faChartBar} className="sidebar-icon" />
                Analytics Overview
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                }}
                className="sidebar-menu-item active"
              >
                <FontAwesomeIcon icon={faTrophy} className="sidebar-icon" /> Referral Leaderboard
              </button>
              <button
                onClick={() => {
                  navigate('/dashboard', { state: { activeTab: 'users' } });
                  setMobileMenuOpen(false);
                }}
                className="sidebar-menu-item"
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
          <h1 className="dashboard-title"><FontAwesomeIcon icon={faTrophy} className="sidebar-icon" /> Referral Leaderboard</h1>
          <p className="dashboard-subtitle">Top performing invite codes and referral metrics</p>
          <div className="metrics-grid">
            <div className="metric-card accent">
              <div className="metric-icon"><FontAwesomeIcon icon={faChartBar} /></div>
              <div className="metric-label">Total Signups</div>
              <div className="metric-value">{total.toLocaleString()}</div>
            </div>
            <div className="metric-card success">
              <div className="metric-icon"><FontAwesomeIcon icon={faShareNodes} /></div>
              <div className="metric-label">Total Referred</div>
              <div className="metric-value">{referralTotalCount.toLocaleString()}</div>
            </div>
            <div className="metric-card info">
              <div className="metric-icon"><FontAwesomeIcon icon={faPercent} /></div>
              <div className="metric-label">Conversion Share</div>
              <div className="metric-value">{referralRate}%</div>
            </div>
          </div>
          <h2 className="section-title"><FontAwesomeIcon icon={faChartPie} /> Waitlist Acquisition Share</h2>
          <div className="chart-card" style={{ marginBottom: '32px' }}>
            {(referralTotalCount > 0 || directTotalCount > 0) ? (
              <Chart options={referralShareOptions} series={referralShareSeries} type="donut" height={300} />
            ) : (
              <p style={{ color: 'var(--color-text-muted)' }}>No data yet</p>
            )}
          </div>
          <h2 className="section-title">Top Referral Codes</h2>
          <div className="chart-card" style={{ marginBottom: '32px' }}>
            {topRefs.length > 0 ? (
              <Chart options={refBarOptions} series={refBarSeries} type="bar" height={350} />
            ) : (
              <p style={{ color: 'var(--color-text-muted)' }}>No referral codes yet.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
