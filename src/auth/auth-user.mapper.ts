export function mapAuthUser(user: {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  createdAt: Date;
  avatarUrl?: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt,
    avatarUrl: user.avatarUrl ?? null,
  };
}
