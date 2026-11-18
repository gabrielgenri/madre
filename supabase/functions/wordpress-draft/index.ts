import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = (Deno.env.get("MADRE_ALLOWED_ORIGINS") ?? "")
  .split(",").map((value) => value.trim()).filter(Boolean);

function corsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin"
  };
  if (origin && allowedOrigins.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders(origin) });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char] ?? char));
}

function inlineMarkdown(value: string) {
  let output = escapeHtml(value);
  output = output.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_match, label, url) => '<a href="' + escapeHtml(url) + '" rel="noopener noreferrer">' + label + '</a>');
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  return output;
}

function markdownToSafeHtml(markdown: string) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let list: "ul" | "ol" | null = null;
  const closeList = () => {
    if (list) blocks.push("</" + list + ">");
    list = null;
  };
  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push("<p>" + paragraph.map(inlineMarkdown).join("<br>") + "</p>");
      paragraph = [];
    }
  };
  for (const line of lines) {
    const heading = line.match(/^\s{0,3}(#{1,4})\s+(.+)$/);
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (!line.trim()) { flushParagraph(); closeList(); continue; }
    if (heading) {
      flushParagraph(); closeList();
      const level = Math.min(heading[1].length + 1, 5);
      blocks.push("<h" + level + ">" + inlineMarkdown(heading[2]) + "</h" + level + ">");
    } else if (bullet || numbered) {
      flushParagraph();
      const nextList = bullet ? "ul" : "ol";
      if (list !== nextList) { closeList(); list = nextList; blocks.push("<" + list + ">"); }
      blocks.push("<li>" + inlineMarkdown((bullet ?? numbered)![1]) + "</li>");
    } else {
      closeList(); paragraph.push(line);
    }
  }
  flushParagraph(); closeList();
  return blocks.join("\n");
}

function slugFor(unitId: string, versionNumber: number) {
  return "madre-" + unitId.replace(/-/g, "").slice(0, 20) + "-v" + versionNumber;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (origin && !allowedOrigins.includes(origin)) return json({ error: "Origen no autorizado." }, 403, null);
  if (req.method === "OPTIONS") return new Response("ok", { status: 204, headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405, origin);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Sesión requerida." }, 401, origin);

    const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
    const publishableKey = publishableKeys.default ?? Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl || !publishableKey) return json({ error: "Configuración interna de Supabase incompleta." }, 500, origin);

    const supabase = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const token = authHeader.slice(7);
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "La sesión no es válida o expiró." }, 401, origin);

    const body = await req.json();
    const unitId = typeof body.unit_id === "string" ? body.unit_id : "";
    if (!/^[0-9a-f-]{36}$/i.test(unitId)) return json({ error: "Unidad editorial no válida." }, 400, origin);

    const roles = await Promise.all([
      supabase.rpc("has_role", { required_role: "editor" }),
      supabase.rpc("has_role", { required_role: "admin" })
    ]);
    if (roles.some((result) => result.error)) throw new Error("No se pudieron comprobar los permisos editoriales.");
    if (!roles.some((result) => result.data === true)) return json({ error: "Solo editor o administrador puede enviar piezas a WordPress." }, 403, origin);

    const { data: unit, error: unitError } = await supabase.from("editorial_units")
      .select("id,title,slug,summary,status")
      .eq("id", unitId).single();
    if (unitError || !unit) return json({ error: "No se encontró la unidad o no tenés acceso." }, 404, origin);
    if (unit.status !== "reviewed") return json({ error: "La unidad debe estar en estado Revisado antes del envío." }, 409, origin);

    const { data: version, error: versionError } = await supabase.from("editorial_versions")
      .select("id,version_number")
      .eq("editorial_unit_id", unitId)
      .order("version_number", { ascending: false }).limit(1).single();
    if (versionError || !version) return json({ error: "No se encontró la versión madre vigente." }, 409, origin);

    const { data: approval, error: approvalError } = await supabase.from("editorial_review_events")
      .select("id").eq("editorial_unit_id", unitId).eq("source_version_id", version.id)
      .eq("event_type", "approved").limit(1).maybeSingle();
    if (approvalError) throw approvalError;
    if (!approval) return json({ error: "Falta la aprobación humana de la versión madre vigente." }, 409, origin);

    const { data: article, error: articleError } = await supabase.from("editorial_formats")
      .select("id,title,content,source_version_id,is_stale")
      .eq("editorial_unit_id", unitId).eq("format_type", "web_seo").single();
    if (articleError || !article) return json({ error: "No existe el artículo Web/SEO." }, 409, origin);
    if (article.is_stale || article.source_version_id !== version.id) return json({ error: "El artículo está desactualizado. Regeneralo o guardalo contra la versión madre vigente." }, 409, origin);
    if (!article.title?.trim() || !article.content?.trim()) return json({ error: "El artículo no tiene título y contenido completos." }, 422, origin);
    if (/\[\s*VERIFICAR\s*\]/i.test(article.title + "\n" + article.content)) {
      return json({ error: "El artículo conserva marcas [VERIFICAR]. Resolvé esas observaciones antes de enviarlo." }, 422, origin);
    }

    const { data: previous, error: previousError } = await supabase.from("editorial_distribution_events")
      .select("id,external_id,external_url,status,created_at")
      .eq("editorial_unit_id", unitId).eq("source_version_id", version.id).eq("channel", "wordpress")
      .maybeSingle();
    if (previousError) throw previousError;
    if (previous) return json({ already_sent: true, event: previous, wordpress: { id: Number(previous.external_id), link: previous.external_url, status: "draft" } }, 200, origin);

    const siteUrl = (Deno.env.get("WORDPRESS_SITE_URL") ?? "").trim().replace(/\/$/, "");
    const username = Deno.env.get("WORDPRESS_USERNAME") ?? "";
    const appPassword = (Deno.env.get("WORDPRESS_APP_PASSWORD") ?? "").replace(/\s/g, "");
    if (!siteUrl || !username || !appPassword) return json({
      error: "Faltan WORDPRESS_SITE_URL, WORDPRESS_USERNAME o WORDPRESS_APP_PASSWORD en los secretos de Supabase.",
      code: "wordpress_not_configured"
    }, 503, origin);
    if (!siteUrl.startsWith("https://")) return json({ error: "WORDPRESS_SITE_URL debe utilizar HTTPS." }, 500, origin);

    const authorization = "Basic " + btoa(username + ":" + appPassword);
    const endpoint = siteUrl + "/wp-json/wp/v2/posts";
    const slug = slugFor(unit.id, version.version_number);
    const requestHeaders = { Authorization: authorization, "Content-Type": "application/json" };

    let post: any = null;
    const lookupUrl = endpoint + "?slug=" + encodeURIComponent(slug) + "&status=draft&context=edit&_fields=id,link,status,slug";
    const lookup = await fetch(lookupUrl, { headers: requestHeaders, signal: AbortSignal.timeout(15000) });
    if (lookup.ok) {
      const matches = await lookup.json();
      if (Array.isArray(matches) && matches.length) post = matches[0];
    }

    if (!post) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify({
          title: article.title,
          content: markdownToSafeHtml(article.content),
          excerpt: unit.summary ?? "",
          slug,
          status: "draft"
        }),
        signal: AbortSignal.timeout(20000)
      });
      const responseText = await response.text();
      let payload: any = {};
      try { payload = responseText ? JSON.parse(responseText) : {}; } catch { /* response handled below */ }
      if (!response.ok) {
        console.error("WordPress REST error", response.status, responseText.slice(0, 1000));
        return json({
          error: response.status === 401 ? "WordPress rechazó las credenciales. Revisá el usuario y la contraseña de aplicación." :
            response.status === 403 ? "El usuario de WordPress no tiene permiso para crear borradores." :
            "WordPress no pudo crear el borrador. Revisá la configuración y los registros.",
          code: "wordpress_api_error",
          wordpress_status: response.status
        }, response.status === 401 || response.status === 403 ? 502 : 502, origin);
      }
      post = payload;
    }

    if (!post?.id || post.status !== "draft" || !post.link) {
      return json({ error: "WordPress no confirmó la creación de un borrador. No se registró el envío en Madre." }, 502, origin);
    }

    const { data: event, error: eventError } = await supabase.from("editorial_distribution_events").insert({
      editorial_unit_id: unitId,
      source_version_id: version.id,
      channel: "wordpress",
      external_id: String(post.id),
      external_url: post.link,
      status: "draft_created",
      created_by: authData.user.id
    }).select("id,external_id,external_url,status,created_at").single();
    if (eventError) {
      console.error("WordPress created but Madre audit insert failed", eventError);
      return json({ error: "WordPress creó el borrador, pero Madre no pudo guardar la trazabilidad. No vuelvas a enviar todavía; revisá el historial.", code: "distribution_audit_failed", wordpress: { id: post.id, link: post.link, status: post.status } }, 502, origin);
    }

    return json({ already_sent: false, event, wordpress: { id: post.id, link: post.link, status: post.status }, source_version_id: version.id }, 200, origin);
  } catch (error) {
    console.error("wordpress-draft error", error);
    return json({ error: "No se pudo completar el envío a WordPress. Revisá la configuración y los registros de la función." }, 500, origin);
  }
});
