export default function AdminLoading() {
  return (
    <div style={{ padding: '40px 0' }}>
      <div className="admin-loading" style={{ justifyContent: 'center', minHeight: 200 }}>
        <div className="admin-spinner" />
        Loading...
      </div>
    </div>
  );
}
