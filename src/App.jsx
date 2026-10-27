import { useCallback, useEffect, useMemo, useState } from "react";
import { articleApi } from "./api";

const emptyArticle = { title: "", content: "", category: "", status: "draft" };
const tabs = [
  { key: "publish", label: "Published" },
  { key: "draft", label: "Drafts" },
  { key: "thrash", label: "Trashed" }
];

function navigate(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function route() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts[0] === "add") return { page: "add" };
  if (parts[0] === "edit" && parts[1]) return { page: "edit", id: parts[1] };
  if (parts[0] === "preview") return { page: "preview" };
  return { page: "posts" };
}

export default function App() {
  const [currentRoute, setCurrentRoute] = useState(route);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPosts(await articleApi.list());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const onPopState = () => setCurrentRoute(route());
    window.addEventListener("popstate", onPopState);
    loadPosts();
    return () => window.removeEventListener("popstate", onPopState);
  }, [loadPosts]);

  const saveArticle = async (data, id) => {
    setError("");
    try {
      if (id) {
        await articleApi.update(id, data);
        setMessage("Article updated.");
      } else {
        await articleApi.create(data);
        setMessage("Article created.");
      }
      await loadPosts();
      navigate("/posts");
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const trashArticle = async (id) => {
    setError("");
    try {
      const post = posts.find((item) => item.id === id);
      if (!post) throw new Error("Article not found");
      await articleApi.update(id, {
        title: post.title,
        content: post.content,
        category: post.category,
        status: "thrash"
      });
      setMessage("Article moved to trash.");
      await loadPosts();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const content = currentRoute.page === "posts"
    ? <PostsPage posts={posts} loading={loading} onTrash={trashArticle} />
    : currentRoute.page === "preview"
      ? <PreviewPage posts={posts} loading={loading} />
      : <EditorPage id={currentRoute.id} posts={posts} onSave={saveArticle} />;

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => navigate("/posts")}>sharing<span>vision</span></button>
        <nav>
          <NavLink active={currentRoute.page === "posts"} onClick={() => navigate("/posts")}>All Posts</NavLink>
          <NavLink active={currentRoute.page === "add"} onClick={() => navigate("/add")}>Add New</NavLink>
          <NavLink active={currentRoute.page === "preview"} onClick={() => navigate("/preview")}>Preview</NavLink>
        </nav>
      </header>
      <main className="content">
        {message && <div className="notice success">{message}<button onClick={() => setMessage("")}>×</button></div>}
        {error && <div className="notice error">{error}<button onClick={() => setError("")}>×</button></div>}
        {content}
      </main>
    </div>
  );
}

function NavLink({ active, onClick, children }) {
  return <button className={`nav-link ${active ? "active" : ""}`} onClick={onClick}>{children}</button>;
}

function PostsPage({ posts, loading, onTrash }) {
  const [tab, setTab] = useState("publish");
  const filtered = posts.filter((post) => post.status === tab);
  return (
    <section>
      <PageHeading title="All Posts" description="Manage your articles in one place." action="Add New" onAction={() => navigate("/add")} />
      <div className="tabs">
        {tabs.map((item) => <button key={item.key} className={tab === item.key ? "selected" : ""} onClick={() => setTab(item.key)}>{item.label}<span>{posts.filter((post) => post.status === item.key).length}</span></button>)}
      </div>
      {loading ? <Loading /> : <ArticleTable posts={filtered} onTrash={onTrash} />}
    </section>
  );
}

function ArticleTable({ posts, onTrash }) {
  if (!posts.length) return <div className="empty">No articles in this tab.</div>;
  return <div className="table-card"><table><thead><tr><th>Title</th><th>Category</th><th>Updated</th><th>Action</th></tr></thead><tbody>
    {posts.map((post) => <tr key={post.id}><td><strong>{post.title}</strong></td><td><span className="tag">{post.category}</span></td><td>{formatDate(post.updated_date)}</td><td className="actions">
      <button className="icon-button" title="Edit" onClick={() => navigate(`/edit/${post.id}`)}><EditIcon /></button>
      {post.status !== "thrash" && <button className="icon-button danger" title="Move to trash" onClick={() => onTrash(post.id)}><TrashIcon /></button>}
    </td></tr>)}
  </tbody></table></div>;
}

function EditorPage({ id, posts, onSave }) {
  const existing = useMemo(() => posts.find((post) => String(post.id) === String(id)), [id, posts]);
  const [form, setForm] = useState(existing ? { title: existing.title, content: existing.content, category: existing.category, status: existing.status } : emptyArticle);
  useEffect(() => { if (existing) setForm({ title: existing.title, content: existing.content, category: existing.category, status: existing.status }); }, [existing]);
  const submit = (status) => onSave({ ...form, status }, id);
  return <section className="editor-section">
    <PageHeading title={id ? "Edit Article" : "Add New Article"} description={id ? "Update your article details." : "Create a new article."} />
    {id && !existing ? <div className="empty">Article not found.</div> : <ArticleForm form={form} setForm={setForm} onSubmit={submit} />}
  </section>;
}

function ArticleForm({ form, setForm, onSubmit }) {
  const update = (field) => (event) => setForm((value) => ({ ...value, [field]: event.target.value }));
  return <form className="form-card" onSubmit={(event) => { event.preventDefault(); onSubmit(form.status); }}>
    <label>Title<input value={form.title} onChange={update("title")} placeholder="At least 20 characters" maxLength="200" required /></label>
    <label>Category<input value={form.category} onChange={update("category")} placeholder="e.g. technology" maxLength="100" required /></label>
    <label>Content<textarea value={form.content} onChange={update("content")} placeholder="At least 200 characters" rows="12" required /></label>
    <div className="form-actions"><button type="button" className="button secondary" onClick={() => navigate("/posts")}>Cancel</button><button type="button" className="button outline" onClick={() => onSubmit("draft")}>Save Draft</button><button type="button" className="button primary" onClick={() => onSubmit("publish")}>Publish</button></div>
  </form>;
}

function PreviewPage({ posts, loading }) {
  const published = posts.filter((post) => post.status === "publish");
  const [page, setPage] = useState(0);
  const pageSize = 3;
  const visible = published.slice(page * pageSize, (page + 1) * pageSize);
  return <section><PageHeading title="Preview" description="Published articles as your readers see them." />
    {loading ? <Loading /> : <div className="preview-grid">{visible.map((post) => <article className="post-card" key={post.id}><span className="tag">{post.category}</span><h2>{post.title}</h2><p>{post.content}</p><small>{formatDate(post.created_date)}</small></article>)}{!visible.length && <div className="empty">No published articles yet.</div>}</div>}
    {published.length > pageSize && <div className="pagination"><button disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page + 1} of {Math.ceil(published.length / pageSize)}</span><button disabled={(page + 1) * pageSize >= published.length} onClick={() => setPage((value) => value + 1)}>Next</button></div>}
  </section>;
}

function PageHeading({ title, description, action, onAction }) {
  return <div className="page-heading"><div><p className="eyebrow">ARTICLE DASHBOARD</p><h1>{title}</h1><p>{description}</p></div>{action && <button className="button primary" onClick={onAction}>+ {action}</button>}</div>;
}

function Loading() { return <div className="empty">Loading articles...</div>; }
function formatDate(value) { return value ? new Date(value).toLocaleDateString() : "—"; }
function EditIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16.5-.8 4.3 4.3-.8L19 8.5 15.5 5 4 16.5ZM14 6.5l3.5 3.5M4 20.8 8.3 20" /></svg>; }
function TrashIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v5M14 11v5M8 7l.7 13h6.6L16 7M9 7l1-3h4l1 3" /></svg>; }
