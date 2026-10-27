const apiBase = import.meta.env.VITE_API_URL || "";

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message || `Request failed (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}

export const articleApi = {
  list: () => request("/article/100/0"),
  get: (id) => request(`/article/${id}`),
  create: (article) => request("/article/", { method: "POST", body: JSON.stringify(article) }),
  update: (id, article) => request(`/article/${id}`, { method: "PATCH", body: JSON.stringify(article) }),
  remove: (id) => request(`/article/${id}`, { method: "DELETE" })
};
