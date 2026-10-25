const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ── Create audit ──────────────────────────────────────────────────────────
export async function createAudit(url: string, config?: Record<string, any>) {
  const response = await fetch(`${API_URL}/audit`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ url, config }),
  });

  if (!response.ok) throw new Error('Audit failed');
  return response.json();
}

// ── Get all audits ────────────────────────────────────────────────────────
export async function getAudits() {
  // ✅ Get token from localStorage
  const token = localStorage.getItem('access_token');
  
  const response = await fetch(`${API_URL}/audit`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      // Token expired or missing - redirect to login
      if (typeof window !== 'undefined') {
        localStorage.clear();
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }
    throw new Error('Failed to fetch audits');
  }
  
  return response.json();
}
export async function cancelAudit(jobId: string) {
  const response = await fetch(`${API_URL}/audit/${jobId}/cancel`, {
    method: 'PATCH',
  });
  if (!response.ok) throw new Error('Cancel failed');
  return response.json();
}

// ── Get one audit by jobId ────────────────────────────────────────────────
export async function getAudit(jobId: string) {
  const response = await fetch(`${API_URL}/audit/${jobId}`);
  if (!response.ok) throw new Error('Audit not found');
  return response.json();
}

export async function deleteAudit(jobId: string): Promise<void> {
  const token = localStorage.getItem("access_token");
  const res = await fetch(`${API_URL}/audit/${jobId}`, { 
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error("Delete failed");
}