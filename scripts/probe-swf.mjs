// throwaway probe: scan increpare.com (Stephen Lavelle, prolific freeware dev) for swf links
for (const page of ["https://www.increpare.com/", "https://www.increpare.com/games.html"]) {
  try {
    const t = await (await fetch(page, { headers: { "user-agent": "Mozilla/5.0 rk8" } })).text();
    const links = [...new Set([...t.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]))];
    const swf = links.filter((l) => l.endsWith(".swf"));
    console.log("==", page, "swf:", swf.slice(0, 20).join(" | ") || "none");
    console.log("   sample links:", links.slice(0, 30).join(" | "));
  } catch (e) {
    console.log(page, "ERR", e.message);
  }
}
