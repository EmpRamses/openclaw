type EnvLike = Record<string, string | undefined>;

const ENV_VAR_NAME_PATTERN = /^[A-Z_][A-Z0-9_]*$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

function resolveTemplateString(template: string, env: EnvLike): string | null {
  if (!template.includes("$")) {
    return template;
  }

  const chunks: string[] = [];

  for (let i = 0; i < template.length; i += 1) {
    const char = template[i];
    if (char !== "$") {
      chunks.push(char);
      continue;
    }

    const next = template[i + 1];
    const afterNext = template[i + 2];

    if (next === "$" && afterNext === "{") {
      const start = i + 3;
      const end = template.indexOf("}", start);
      if (end !== -1) {
        const name = template.slice(start, end);
        if (ENV_VAR_NAME_PATTERN.test(name)) {
          chunks.push(`\${${name}}`);
          i = end;
          continue;
        }
      }
    }

    if (next === "{") {
      const start = i + 2;
      const end = template.indexOf("}", start);
      if (end !== -1) {
        const name = template.slice(start, end);
        if (ENV_VAR_NAME_PATTERN.test(name)) {
          const value = env[name];
          if (value === undefined || value === "") {
            return null;
          }
          chunks.push(value);
          i = end;
          continue;
        }
      }
    }

    chunks.push(char);
  }

  return chunks.join("");
}

export function restoreEnvVarRefs(
  incoming: unknown,
  parsed: unknown,
  env: EnvLike = process.env,
): unknown {
  if (typeof incoming === "string" && typeof parsed === "string") {
    const resolved = resolveTemplateString(parsed, env);
    if (resolved !== null && resolved === incoming) {
      return parsed;
    }
    return incoming;
  }

  if (Array.isArray(incoming) && Array.isArray(parsed)) {
    return incoming.map((item, index) =>
      index < parsed.length ? restoreEnvVarRefs(item, parsed[index], env) : item,
    );
  }

  if (isPlainObject(incoming) && isPlainObject(parsed)) {
    const restored: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(incoming)) {
      restored[key] = key in parsed ? restoreEnvVarRefs(value, parsed[key], env) : value;
    }
    return restored;
  }

  return incoming;
}
