export const buildPhotoGlassStyle = (
  image: string | undefined,
  theme: "whitePink" | "luxuryBlue" | "darkRed" | "blackout",
  strength = 0.9,
  extraOverlay?: string
) => {
  if (!image) {
    return undefined;
  }

  const overlay =
    extraOverlay ||
    (theme === "whitePink"
      ? `linear-gradient(180deg, rgba(255,255,255,${strength}), rgba(255,241,248,${Math.min(0.98, strength + 0.05)}))`
      : theme === "darkRed"
        ? `linear-gradient(180deg, rgba(34,9,14,${strength}), rgba(18,5,8,${Math.min(0.98, strength + 0.05)}))`
        : theme === "blackout"
          ? `linear-gradient(180deg, rgba(5,5,7,${strength}), rgba(2,2,3,${Math.min(0.98, strength + 0.05)}))`
          : `linear-gradient(180deg, rgba(7,16,31,${strength}), rgba(8,18,34,${Math.min(0.98, strength + 0.04)}))`);

  return {
    backgroundImage: `${overlay}, url(${image})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat"
  };
};
