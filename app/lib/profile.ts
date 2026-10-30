export type ProfileUpdate = {
  name: string;
  profilePhoto: string | null;
};

export function validateProfileUpdate(input: unknown):
  | { ok: true; value: ProfileUpdate }
  | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Dados do perfil inválidos." };
  const payload = input as { name?: unknown; profilePhoto?: unknown };
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (name.length < 3 || name.length > 120) {
    return { ok: false, error: "Informe um nome entre 3 e 120 caracteres." };
  }

  const profilePhoto = payload.profilePhoto;
  if (profilePhoto !== null && (
    typeof profilePhoto !== "string" ||
    profilePhoto.length > 300_000 ||
    !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(profilePhoto)
  )) {
    return { ok: false, error: "Escolha uma foto JPG, PNG ou WebP válida e menor." };
  }

  return { ok: true, value: { name, profilePhoto } };
}
