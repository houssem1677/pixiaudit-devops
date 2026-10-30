'use client';

import { useState, useEffect , useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  UserPlus, 
  Trash2, 
  Search, 
  Shield, 
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card , CardContent } from '@/components/ui/card';

interface User {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: 'ADMIN' | 'USER';
  createdAt: string;
  updatedAt: string;
}

interface UserStats {
  totalUsers: number;
  adminCount: number;
  userCount: number;
}

interface Audit {
  id: number;
  jobId: string;
  url: string;
  globalScore: number | null;
  createdAt: string;
  status: string;
}

interface RecommendationHistory {
  id: number;
  version: number;
  changeType: string;
  modifiedBy?: {
    prenom: string;
    nom: string;
  } | null;
  createdAt: string;
  recommendations: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // --- New state for audits & recommendation history ---
  const [showAuditsModal, setShowAuditsModal] = useState(false);
  const [selectedUserForAudits, setSelectedUserForAudits] = useState<User | null>(null);
  const [userAudits, setUserAudits] = useState<Audit[]>([]);
  const [loadingAudits, setLoadingAudits] = useState(false);

  const [showRecoModal, setShowRecoModal] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);
  const [recommendationHistory, setRecommendationHistory] = useState<RecommendationHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ADMIN PAGE GUARD - Check if user is admin
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const role = localStorage.getItem("user_role");
    
    if (!token || role !== "ADMIN") {
      router.replace("/dashboard");
    } else {
      setIsAuthorized(true);
    }
  }, [router]);

  const getAuthHeaders = useCallback(() => {
  const token = localStorage.getItem("access_token");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}, []);

  const fetchStats = useCallback(async () => {
    if (!isAuthorized) return;
    try {
      const res = await fetch('http://localhost:3001/users/stats', {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, [isAuthorized, getAuthHeaders]);

  const fetchUsers = useCallback(async () => {
    if (!isAuthorized) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(search && { search }),
      });

      const res = await fetch(`http://localhost:3001/users?${params}`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          router.replace("/dashboard");
          return;
        }
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      
      if (Array.isArray(data)) {
        setUsers(data);
        setTotalPages(1);
      } else if (data.data && data.meta) {
        setUsers(data.data);
        setTotalPages(data.meta.totalPages || 1);
      } else {
        setUsers([]);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setUsers([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [isAuthorized, page, search, router, getAuthHeaders]);

  useEffect(() => {
    if (isAuthorized) {
      fetchStats();
    }
  }, [isAuthorized, fetchStats]);

  useEffect(() => {
    if (isAuthorized) {
      fetchUsers();
    }
  }, [page, search, isAuthorized, fetchUsers]);

  const handleDelete = async (userId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
      return;
    }

    try {
      const res = await fetch(`http://localhost:3001/users/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (res.ok) {
        fetchUsers();
        fetchStats();
      } else {
        const error = await res.json();
        alert(error.message || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const handleRoleToggle = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'ADMIN' ? 'USER' : 'ADMIN';

    try {
      const res = await fetch(`http://localhost:3001/users/${userId}/role`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        fetchUsers();
        fetchStats();
      } else {
        const error = await res.json();
        alert(error.message || 'Erreur lors du changement de rôle');
      }
    } catch (error) {
      console.error('Failed to change role:', error);
      alert('Erreur lors du changement de rôle');
    }
  };

  // --- fetch audits for a user ---
  const fetchAuditsByUser = async (userId: string) => {
    setLoadingAudits(true);
    try {
      const res = await fetch(`http://localhost:3001/audit/user/${userId}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setUserAudits(data);
      } else {
        setUserAudits([]);
      }
    } catch (error) {
      console.error('Failed to fetch user audits:', error);
      setUserAudits([]);
    } finally {
      setLoadingAudits(false);
    }
  };

  // --- fetch recommendation history for an audit (by jobId) ---
  const fetchRecommendationHistory = async (jobId: string) => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`http://localhost:3001/audit/${jobId}/recommendations/history`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setRecommendationHistory(data);
      } else {
        setRecommendationHistory([]);
      }
    } catch (error) {
      console.error('Failed to fetch recommendation history:', error);
      setRecommendationHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // --- Handlers for clicks ---
  const handleUserClick = (user: User) => {
    setSelectedUserForAudits(user);
    fetchAuditsByUser(user.id);
    setShowAuditsModal(true);
  };

  const handleAuditClick = (audit: Audit) => {
    setSelectedAudit(audit);
    fetchRecommendationHistory(audit.jobId);
    setShowRecoModal(true);
  };

  // Show loading while checking authorization
  if (!isAuthorized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-[#79C300] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Vérification des permissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-white ">
      <div className="w-full max-w-7xl mx-auto px-6 pt-8 pb-12 md:px-8 md:pt-12 md:pb-16">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Gestion des utilisateurs
          </h1>
          <p className="text-sm md:text-base text-gray-500">
            Gérez les comptes utilisateurs et leurs permissions
          </p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total utilisateurs</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">
                      {stats.totalUsers}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
                    <UserIcon className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Administrateurs</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">
                      {stats.adminCount}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-purple-50 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Utilisateurs standard</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">
                      {stats.userCount}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center">
                    <UserIcon className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <Input
              type="text"
              placeholder="Rechercher par email, nom ou prénom..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 h-11 rounded-lg border-gray-200 focus:border-[#79C300] focus:ring-[#79C300]"
            />
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="h-11 bg-[#79C300] text-white rounded-lg font-medium shadow-sm hover:bg-[#6aad00] transition-colors"
          >
            <UserPlus size={18} className="mr-2" />
            Nouvel utilisateur
          </Button>
        </div>

        {/* Users Table */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Utilisateur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Rôle
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Créé le
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center gap-2 text-gray-500">
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-[#79C300] rounded-full animate-spin" />
                        Chargement...
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      Aucun utilisateur trouvé
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr 
                      key={user.id} 
                      onClick={() => handleUserClick(user)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">
                          {user.prenom} {user.nom}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {user.email}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRoleToggle(user.id, user.role);
                          }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            user.role === 'ADMIN'
                              ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {user.role === 'ADMIN' ? <Shield size={12} /> : <UserIcon size={12} />}
                          {user.role === 'ADMIN' ? 'Admin' : 'Utilisateur'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(user.id);
                            }}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center">
              <div className="text-sm text-gray-500">
                Page {page} sur {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </Card>

        {/* Create Modal */}
        {showCreateModal && (
          <CreateUserModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              fetchUsers();
              fetchStats();
            }}
          />
        )}

        {/* Audits Modal */}
        {showAuditsModal && selectedUserForAudits && (
          <AuditsModal
            user={selectedUserForAudits}
            audits={userAudits}
            loading={loadingAudits}
            onClose={() => {
              setShowAuditsModal(false);
              setSelectedUserForAudits(null);
              setUserAudits([]);
            }}
            onAuditClick={handleAuditClick}
          />
        )}

        {/* Recommendation History Modal */}
        {showRecoModal && selectedAudit && (
          <RecommendationHistoryModal
            audit={selectedAudit}
            history={recommendationHistory}
            loading={loadingHistory}
            onClose={() => {
              setShowRecoModal(false);
              setSelectedAudit(null);
              setRecommendationHistory([]);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ==================== MODAL COMPONENTS ====================

// Create User Modal Component
function CreateUserModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nom: '',
    prenom: '',
    role: 'USER' as 'USER' | 'ADMIN',
  });
  const [loading, setLoading] = useState(false);

const getAuthHeaders = useCallback(() => {
  const token = localStorage.getItem("access_token");
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('http://localhost:3001/users', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const error = await res.json();
        alert(error.message || 'Erreur lors de la création');
      }
    } catch (error) {
      console.error('Failed to create user:', error);
      alert('Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">Créer un utilisateur</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <Label className="text-sm font-medium text-gray-700 block mb-1.5">Email</Label>
            <Input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="h-11 rounded-lg border-gray-200 focus:border-[#79C300] focus:ring-[#79C300]" />
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700 block mb-1.5">Mot de passe</Label>
            <Input type="password" required minLength={8} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="h-11 rounded-lg border-gray-200 focus:border-[#79C300] focus:ring-[#79C300]" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-700 block mb-1.5">Prénom</Label>
              <Input type="text" required value={formData.prenom} onChange={(e) => setFormData({ ...formData, prenom: e.target.value })} className="h-11 rounded-lg border-gray-200 focus:border-[#79C300] focus:ring-[#79C300]" />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700 block mb-1.5">Nom</Label>
              <Input type="text" required value={formData.nom} onChange={(e) => setFormData({ ...formData, nom: e.target.value })} className="h-11 rounded-lg border-gray-200 focus:border-[#79C300] focus:ring-[#79C300]" />
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700 block mb-1.5">Rôle</Label>
            <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as 'USER' | 'ADMIN' })} className="w-full px-3 py-2 h-11 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:ring-2 focus:ring-[#79C300] focus:border-transparent">
              <option value="USER">Utilisateur</option>
              <option value="ADMIN">Administrateur</option>
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-11 rounded-lg">Annuler</Button>
            <Button type="submit" disabled={loading} className="flex-1 h-11 bg-[#79C300] text-white rounded-lg font-medium hover:bg-[#6aad00] transition-colors">{loading ? 'Création...' : 'Créer'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Audits Modal – shows all audits for a specific user
interface AuditsModalProps {
  user: User;
  audits: Audit[];
  loading: boolean;
  onClose: () => void;
  onAuditClick: (audit: Audit) => void;
}

function AuditsModal({
  user,
  audits,
  loading,
  onClose,
  onAuditClick,
}: AuditsModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">
            Audits de {user.prenom} {user.nom}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-[#79C300] rounded-full animate-spin" />
            </div>
          ) : audits.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Aucun audit trouvé</p>
          ) : (
            <div className="space-y-3">
              {audits.map((audit) => (
                <div
                  key={audit.id}
                  onClick={() => onAuditClick(audit)}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">{audit.url}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(audit.createdAt).toLocaleString('fr-FR')}
                      </p>
                    </div>
                    <div className="px-2 py-1 bg-gray-100 rounded text-sm font-medium">
                      Score: {audit.globalScore ?? 'N/A'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-6 border-t border-gray-100 flex justify-end">
          <Button onClick={onClose} variant="outline">Fermer</Button>
        </div>
      </div>
    </div>
  );
}

// Recommendation History Modal – with collapsible versions
interface RecommendationHistoryModalProps {
  audit: Audit;
  history: RecommendationHistory[];
  loading: boolean;
  onClose: () => void;
}

function RecommendationHistoryModal({
  audit,
  history,
  loading,
  onClose,
}: RecommendationHistoryModalProps) {
  const [expandedVersions, setExpandedVersions] = useState<Set<number> | null>(null);

const latestVersion =
  history.length > 0
    ? Math.max(...history.map((item) => item.version))
    : null;

const toggleVersion = (version: number) => {
  setExpandedVersions((current) => {
    const next = new Set(
      current ?? (latestVersion !== null ? [latestVersion] : [])
    );

    if (next.has(version)) {
      next.delete(version);
    } else {
      next.add(version);
    }

    return next;
  });
};





  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">
            Historique des recommandations
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Audit URL: <span className="font-medium">{audit.url}</span></p>
            <p className="text-sm text-gray-600 mt-1">Date: {new Date(audit.createdAt).toLocaleString('fr-FR')}</p>
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-[#79C300] rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Aucun historique trouvé</p>
          ) : (
            <div className="space-y-3">
              {history.map((item) => {
                const isExpanded =
                  expandedVersions === null
                    ? item.version === latestVersion
                    : expandedVersions.has(item.version);
                return (
                  <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleVersion(item.version)}
                      className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Version {item.version}
                        </span>
                        <span className="text-xs text-gray-500">
                          {item.changeType === 'ai_generated' ? '🤖 IA générée' : '✏️ Modification manuelle'}
                        </span>
                        {item.modifiedBy && (
                          <span className="text-xs text-gray-400">
                            par {item.modifiedBy.prenom} {item.modifiedBy.nom}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">
                          {new Date(item.createdAt).toLocaleString('fr-FR')}
                        </span>
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="p-4 border-t border-gray-100">
                        <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded">
                          {item.recommendations}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="p-6 border-t border-gray-100 flex justify-end">
          <Button onClick={onClose} variant="outline">Fermer</Button>
        </div>
      </div>
    </div>
  );
}