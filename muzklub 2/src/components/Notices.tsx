type Props = { loading: string; message: string };

export default function Notices({ loading, message }: Props) {
  return (
    <>
      {loading && <p className="notice notice--loading" role="status">{loading}</p>}
      {message && <p className="notice" role="status">{message}</p>}
    </>
  );
}
