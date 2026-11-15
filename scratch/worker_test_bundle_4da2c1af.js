// node_modules/hono/dist/http-exception.js
var HTTPException = class extends Error {
  res;
  status;
  /**
  * Creates an instance of `HTTPException`.
  * @param status - HTTP status code for the exception. Defaults to 500.
  * @param options - Additional options for the exception.
  */
  constructor(status = 500, options) {
    super(options?.message, { cause: options?.cause });
    this.res = options?.res;
    this.status = status;
  }
  /**
  * Returns the response object associated with the exception.
  * If a response object is not provided, a new response is created with the error message and status code.
  * @returns The response object.
  */
  getResponse() {
    if (this.res) return new Response(this.res.body, {
      status: this.status,
      headers: this.res.headers
    });
    return new Response(this.message, { status: this.status });
  }
};

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/buffer.js
var bufferToFormData = (arrayBuffer, contentType) => {
  return new Response(arrayBuffer, { headers: { "Content-Type": contentType.replace(/^[^;]+/, (mediaType) => mediaType.toLowerCase()) } }).formData();
};

// node_modules/hono/dist/utils/body.js
var MAX_NESTED_OBJECTS = 1e4;
var isRawRequest = (request) => "headers" in request;
var parseBody = async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const mediaType = (isRawRequest(request) ? request.headers : request.raw.headers).get("Content-Type")?.split(";")[0].trim().toLowerCase();
  if (mediaType === "multipart/form-data" || mediaType === "application/x-www-form-urlencoded") return parseFormData(request, {
    all,
    dot
  });
  return {};
};
async function parseFormData(request, options) {
  if (!isRawRequest(request) && request.bodyCache.formData) return convertFormDataToBodyData(await request.bodyCache.formData, options);
  const headers = isRawRequest(request) ? request.headers : request.raw.headers;
  const arrayBuffer = await request.arrayBuffer();
  const formDataPromise = bufferToFormData(arrayBuffer, headers.get("Content-Type") || "");
  if (!isRawRequest(request)) request.bodyCache.formData = formDataPromise;
  const formData = await formDataPromise;
  if (formData) return convertFormDataToBodyData(formData, options);
  return {};
}
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  const nestingState = { count: 0 };
  formData.forEach((value, key) => {
    if (!(options.all || key.endsWith("[]"))) form[key] = value;
    else handleParsingAllValues(form, key, value);
  });
  if (options.dot) Object.entries(form).forEach(([key, value]) => {
    if (key.includes(".")) {
      handleParsingNestedValues(form, key, value, nestingState);
      delete form[key];
    }
  });
  return form;
}
var handleParsingAllValues = (form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) form[key].push(value);
    else form[key] = [form[key], value];
  } else if (!key.endsWith("[]")) form[key] = value;
  else form[key] = [value];
};
var handleParsingNestedValues = (form, key, value, state) => {
  if (/(?:^|\.)__proto__\./.test(key)) return;
  let nestedForm = form;
  const keys = key.split(".", 34);
  if (keys.length > 33) throwNestingLimitExceeded();
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) nestedForm[key2] = value;
    else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        if (state.count++ >= MAX_NESTED_OBJECTS) throwNestingLimitExceeded();
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
};
var throwNestingLimitExceeded = () => {
  throw new Error("Nesting limit exceeded");
};

// node_modules/hono/dist/utils/url.js
var splitPath = (path) => {
  const paths = path.split("/");
  if (paths[0] === "") paths.shift();
  return paths;
};
var splitRoutingPath = (routePath2) => {
  const { groups, path } = extractGroupsFromPath(routePath2);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
};
var extractGroupsFromPath = (path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return {
    groups,
    path
  };
};
var replaceGroupMarks = (paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) if (paths[j].includes(mark)) {
      paths[j] = paths[j].replace(mark, groups[i][1]);
      break;
    }
  }
  return paths;
};
var patternCache = {};
var getPattern = (label, next) => {
  if (label === "*") return "*";
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [
        cacheKey,
        match2[1],
        new RegExp(`^${match2[2]}(?=/${next})`)
      ] : [
        label,
        match2[1],
        new RegExp(`^${match2[2]}$`)
      ];
      else patternCache[cacheKey] = [
        label,
        match2[1],
        true
      ];
    }
    return patternCache[cacheKey];
  }
  return null;
};
var tryDecode = (str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
};
var decodeURIWithPreservedPercent = (value) => decodeURI(value.includes("%25") ? value.replace(/%25/g, "%2525") : value);
var getPath = (request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      const decoded = tryDecode(path, decodeURIWithPreservedPercent);
      if (/%(?![0-9A-Fa-f]{2})/.test(path)) {
        const rewritten = new URL("http://localhost");
        rewritten.pathname = decoded.replace(/[\\\t\n\r]/g, encodeURIComponent);
        if (tryDecode(rewritten.pathname, decodeURIWithPreservedPercent) !== decoded) return tryDecode(path.replace(/%(?![0-9A-Fa-f]{2})/g, "%25"), decodeURIWithPreservedPercent);
      }
      return decoded;
    } else if (charCode === 63 || charCode === 35) break;
  }
  return url.slice(start, i);
};
var getPathNoStrict = (request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
};
var mergePath = (base, sub, ...rest) => {
  if (rest.length) sub = mergePath(sub, ...rest);
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
};
var checkOptionalParameter = (path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) return null;
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) basePath += "/" + segment;
    else if (/\:/.test(segment)) {
      if (segment.charCodeAt(segment.length - 1) === 63) {
        if (results.length === 0 && basePath === "") results.push("/");
        else results.push(basePath);
        const optionalSegment = segment.slice(0, -1);
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else basePath += "/" + segment;
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
};
var tryDecodeURIComponent = (str) => str.indexOf("%") !== -1 ? tryDecode(str, decodeURIComponent_) : str;
var _decodeURI = (value) => {
  if (value.indexOf("+") !== -1) value = value.replace(/\+/g, " ");
  return tryDecodeURIComponent(value);
};
var _getQueryParam = (url, key, multiple) => {
  const hashIndex = url.indexOf("#", 8);
  if (hashIndex !== -1) url = url.slice(0, hashIndex);
  let encoded;
  if (!multiple && key && !/[%+&=]/.test(key)) {
    const queryIndex = url.indexOf("?", 8);
    let keyIndex2 = queryIndex;
    if (keyIndex2 === -1) return;
    if (!url.startsWith(key, keyIndex2 + 1)) keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61 || trailingKeyCode === 38 || isNaN(trailingKeyCode)) {
        if (keyIndex2 > queryIndex && /(?:^|&)[^=&]*[%+]/.test(url.slice(queryIndex + 1, keyIndex2))) break;
        if (trailingKeyCode === 61) {
          const valueIndex = keyIndex2 + key.length + 2;
          const endIndex = url.indexOf("&", valueIndex);
          return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
        }
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) return;
  }
  const results = /* @__PURE__ */ Object.create(null);
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) valueIndex = -1;
    let name = url.slice(keyIndex + 1, valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex);
    if (encoded) name = _decodeURI(name);
    keyIndex = nextKeyIndex;
    if (name === "") continue;
    let value;
    if (valueIndex === -1) value = "";
    else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) value = _decodeURI(value);
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) results[name] = [];
      results[name].push(value);
    } else results[name] ??= value;
  }
  return key ? results[key] : results;
};
var getQueryParam = _getQueryParam;
var getQueryParams = (url, key) => {
  return _getQueryParam(url, key, true);
};
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var HonoRequest = class {
  /**
  * `.raw` can get the raw Request object.
  *
  * @see {@link https://hono.dev/docs/api/request#raw}
  *
  * @example
  * ```ts
  * // For Cloudflare Workers
  * app.post('/', async (c) => {
  *   const metadata = c.req.raw.cf?.hostMetadata?
  *   ...
  * })
  * ```
  */
  raw;
  #validatedData;
  #matchResult;
  routeIndex = 0;
  /**
  * `.path` can get the pathname of the request.
  *
  * @see {@link https://hono.dev/docs/api/request#path}
  *
  * @example
  * ```ts
  * app.get('/about/me', (c) => {
  *   const pathname = c.req.path // `/about/me`
  * })
  * ```
  */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex]?.[1][key];
    const param = this.#getParamValue(paramKey);
    return param && tryDecodeURIComponent(param);
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex]?.[1] ?? {});
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) decoded[key] = tryDecodeURIComponent(value);
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) return this.raw.headers.get(name) ?? void 0;
    const headerData = /* @__PURE__ */ Object.create(null);
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = (key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) return cachedBody;
    for (const anyCachedKey in bodyCache) return bodyCache[anyCachedKey].then((body) => {
      if (anyCachedKey === "json") body = JSON.stringify(body);
      const contentType = anyCachedKey === "formData" ? void 0 : raw2.headers.get("content-type");
      return new Response(body, { headers: contentType ? { "Content-Type": contentType } : void 0 })[key]();
    });
    return bodyCache[key] = raw2[key]();
  };
  /**
  * `.json()` can parse Request body of type `application/json`
  *
  * @see {@link https://hono.dev/docs/api/request#json}
  *
  * @example
  * ```ts
  * app.post('/entry', async (c) => {
  *   const body = await c.req.json()
  * })
  * ```
  */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
  * `.text()` can parse Request body of type `text/plain`
  *
  * @see {@link https://hono.dev/docs/api/request#text}
  *
  * @example
  * ```ts
  * app.post('/entry', async (c) => {
  *   const body = await c.req.text()
  * })
  * ```
  */
  text() {
    return this.#cachedBody("text");
  }
  /**
  * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
  *
  * @see {@link https://hono.dev/docs/api/request#arraybuffer}
  *
  * @example
  * ```ts
  * app.post('/entry', async (c) => {
  *   const body = await c.req.arrayBuffer()
  * })
  * ```
  */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
  * `.bytes()` parses the request body as a `Uint8Array`.
  *
  * @see {@link https://hono.dev/docs/api/request#bytes}
  *
  * @example
  * ```ts
  * app.post('/entry', async (c) => {
  *   const body = await c.req.bytes()
  * })
  * ```
  */
  bytes() {
    return this.#cachedBody("arrayBuffer").then((buffer) => new Uint8Array(buffer));
  }
  /**
  * Parses the request body as a `Blob`.
  * @example
  * ```ts
  * app.post('/entry', async (c) => {
  *   const body = await c.req.blob();
  * });
  * ```
  * @see https://hono.dev/docs/api/request#blob
  */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
  * Parses the request body as `FormData`.
  * @example
  * ```ts
  * app.post('/entry', async (c) => {
  *   const body = await c.req.formData();
  * });
  * ```
  * @see https://hono.dev/docs/api/request#formdata
  */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
  * Adds validated data to the request.
  *
  * @param target - The target of the validation.
  * @param data - The validated data to add.
  */
  addValidatedData(target, data) {
    (this.#validatedData ??= {})[target] = data;
  }
  valid(target) {
    return this.#validatedData?.[target];
  }
  /**
  * `.url` can get the request url strings.
  *
  * @see {@link https://hono.dev/docs/api/request#url}
  *
  * @example
  * ```ts
  * app.get('/about/me', (c) => {
  *   const url = c.req.url // `http://localhost:8787/about/me`
  *   ...
  * })
  * ```
  */
  get url() {
    return this.raw.url;
  }
  /**
  * `.method` can get the method name of the request.
  *
  * @see {@link https://hono.dev/docs/api/request#method}
  *
  * @example
  * ```ts
  * app.get('/about/me', (c) => {
  *   const method = c.req.method // `GET`
  * })
  * ```
  */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
  * `.matchedRoutes` can return a matched route in the handler
  *
  * @deprecated
  *
  * Use matchedRoutes helper defined in "hono/route" instead.
  *
  * @see {@link https://hono.dev/docs/api/request#matchedroutes}
  *
  * @example
  * ```ts
  * app.use('*', async function logger(c, next) {
  *   await next()
  *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
  *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
  *     console.log(
  *       method,
  *       ' ',
  *       path,
  *       ' '.repeat(Math.max(10 - path.length, 0)),
  *       name,
  *       i === c.req.routeIndex ? '<- respond from here' : ''
  *     )
  *   })
  * })
  * ```
  */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
  * `.routePath` can retrieve the path registered within the handler
  *
  * @deprecated
  *
  * Use routePath helper defined in "hono/route" instead.
  *
  * @see {@link https://hono.dev/docs/api/request#routepath}
  *
  * @example
  * ```ts
  * app.get('/posts/:id', (c) => {
  *   return c.json({ path: c.req.routePath })
  * })
  * ```
  */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = (value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
};
var resolveCallback = async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) str = str.toString();
    if (str instanceof Promise) str = await str;
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) return Promise.resolve(str);
  if (buffer) buffer[0] += str;
  else buffer = [str];
  const resStr = Promise.all(callbacks.map((c) => c({
    phase,
    buffer,
    context
  }))).then((res) => Promise.all(res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))).then(() => buffer[0]));
  if (preserveCallbacks) return raw(await resStr, callbacks);
  else return resStr;
};

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = (contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
};
var createResponseInstance = (body, init) => new Response(body, init);
var Context = class {
  #rawRequest;
  #req;
  /**
  * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
  *
  * @see {@link https://hono.dev/docs/api/context#env}
  *
  * @example
  * ```ts
  * // Environment object for Cloudflare Workers
  * app.get('*', async c => {
  *   const counter = c.env.COUNTER
  * })
  * ```
  */
  env = {};
  #var;
  finalized = false;
  /**
  * `.error` can get the error object from the middleware if the Handler throws an error.
  *
  * @see {@link https://hono.dev/docs/api/context#error}
  *
  * @example
  * ```ts
  * app.use('*', async (c, next) => {
  *   await next()
  *   if (c.error) {
  *     // do something...
  *   }
  * })
  * ```
  */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
  * Creates an instance of the Context class.
  *
  * @param req - The Request object.
  * @param options - Optional configuration options for the context.
  */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
  * `.req` is the instance of {@link HonoRequest}.
  */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
  * @see {@link https://hono.dev/docs/api/context#event}
  * The FetchEvent associated with the current request.
  *
  * @throws Will throw an error if the context does not have a FetchEvent.
  */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) return this.#executionCtx;
    else throw Error("This context has no FetchEvent");
  }
  /**
  * @see {@link https://hono.dev/docs/api/context#executionctx}
  * The ExecutionContext associated with the current request.
  *
  * @throws Will throw an error if the context does not have an ExecutionContext.
  */
  get executionCtx() {
    if (this.#executionCtx) return this.#executionCtx;
    else throw Error("This context has no ExecutionContext");
  }
  /**
  * @see {@link https://hono.dev/docs/api/context#res}
  * The Response object for the current request.
  */
  get res() {
    return this.#res ||= createResponseInstance(null, { headers: this.#preparedHeaders ??= new Headers() });
  }
  /**
  * Sets the Response object for the current request.
  *
  * @param _res - The Response object to set.
  */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") continue;
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) _res.headers.append("set-cookie", cookie);
        } else _res.headers.set(k, v);
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
  * `.render()` can create a response within a layout.
  *
  * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
  *
  * @example
  * ```ts
  * app.get('/', (c) => {
  *   return c.render('Hello!')
  * })
  * ```
  */
  render = (...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  };
  /**
  * Sets the layout for the response.
  *
  * @param layout - The layout to set.
  * @returns The layout function.
  */
  setLayout = (layout) => this.#layout = layout;
  /**
  * Gets the current layout for the response.
  *
  * @returns The current layout function.
  */
  getLayout = () => this.#layout;
  /**
  * `.setRenderer()` can set the layout in the custom middleware.
  *
  * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
  *
  * @example
  * ```tsx
  * app.use('*', async (c, next) => {
  *   c.setRenderer((content) => {
  *     return c.html(
  *       <html>
  *         <body>
  *           <p>{content}</p>
  *         </body>
  *       </html>
  *     )
  *   })
  *   await next()
  * })
  * ```
  */
  setRenderer = (renderer) => {
    this.#renderer = renderer;
  };
  /**
  * `.header()` can set headers.
  *
  * @see {@link https://hono.dev/docs/api/context#header}
  *
  * @example
  * ```ts
  * app.get('/welcome', (c) => {
  *   // Set headers
  *   c.header('X-Message', 'Hello!')
  *   c.header('Content-Type', 'text/plain')
  *
  *   // Append multiple headers using the append option (e.g. Vary)
  *   c.header('Vary', 'Accept-Encoding', { append: true })
  *   c.header('Vary', 'User-Agent', { append: true })
  *
  *   return c.body('Thank you for coming')
  * })
  * ```
  */
  header = (name, value, options) => {
    if (this.finalized && !this.#res.bodyUsed) this.#res = createResponseInstance(this.#res.body, this.#res);
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) headers.delete(name);
    else if (options?.append) headers.append(name, value);
    else headers.set(name, value);
  };
  status = (status) => {
    this.#status = status;
  };
  /**
  * `.set()` can set the value specified by the key.
  *
  * @see {@link https://hono.dev/docs/api/context#set-get}
  *
  * @example
  * ```ts
  * app.use('*', async (c, next) => {
  *   c.set('message', 'Hono is hot!!')
  *   await next()
  * })
  * ```
  */
  set = (key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  };
  /**
  * `.get()` can use the value specified by the key.
  *
  * @see {@link https://hono.dev/docs/api/context#set-get}
  *
  * @example
  * ```ts
  * app.get('/', (c) => {
  *   const message = c.get('message')
  *   return c.text(`The message is "${message}"`)
  * })
  * ```
  */
  get = (key) => {
    return this.#var ? this.#var.get(key) : void 0;
  };
  /**
  * `.var` can access the value of a variable.
  *
  * @see {@link https://hono.dev/docs/api/context#var}
  *
  * @example
  * ```ts
  * const result = c.var.client.oneMethod()
  * ```
  */
  get var() {
    if (!this.#var) return {};
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    let responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders;
    if (typeof arg === "object" && arg.headers) {
      responseHeaders ??= new Headers();
      for (const [key, value] of new Headers(arg.headers)) if (key === "set-cookie") responseHeaders.append(key, value);
      else responseHeaders.set(key, value);
    }
    if (headers) {
      if (!responseHeaders) {
        let count = 0;
        for (const k in headers) if (++count > 1 || typeof headers[k] !== "string") {
          responseHeaders = new Headers();
          break;
        }
      }
      if (responseHeaders) for (const k in headers) {
        const v = headers[k];
        if (typeof v === "string") responseHeaders.set(k, v);
        else {
          responseHeaders.delete(k);
          for (const v2 of v) responseHeaders.append(k, v2);
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, {
      status,
      headers: responseHeaders ?? headers
    });
  }
  newResponse = (...args) => this.#newResponse(...args);
  /**
  * `.body()` can return the HTTP response.
  * You can set headers with `.header()` and set HTTP status code with `.status`.
  * This can also be set in `.text()`, `.json()` and so on.
  *
  * @see {@link https://hono.dev/docs/api/context#body}
  *
  * @example
  * ```ts
  * app.get('/welcome', (c) => {
  *   // Set headers
  *   c.header('X-Message', 'Hello!')
  *   c.header('Content-Type', 'text/plain')
  *   // Set HTTP status code
  *   c.status(201)
  *
  *   // Return the response body
  *   return c.body('Thank you for coming')
  * })
  * ```
  */
  body = (data, arg, headers) => this.#newResponse(data, arg, headers);
  /**
  * `.text()` can render text as `Content-Type:text/plain`.
  *
  * @see {@link https://hono.dev/docs/api/context#text}
  *
  * @example
  * ```ts
  * app.get('/say', (c) => {
  *   return c.text('Hello!')
  * })
  * ```
  */
  text = (text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(text, arg, setDefaultContentType(TEXT_PLAIN, headers));
  };
  /**
  * `.json()` can render JSON as `Content-Type:application/json`.
  *
  * @see {@link https://hono.dev/docs/api/context#json}
  *
  * @example
  * ```ts
  * app.get('/api', (c) => {
  *   return c.json({ message: 'Hello!' })
  * })
  * ```
  */
  json = (object, arg, headers) => {
    return this.#newResponse(JSON.stringify(object), arg, setDefaultContentType("application/json", headers));
  };
  html = (html, arg, headers) => {
    const res = (html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers));
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  };
  /**
  * `.redirect()` can Redirect, default status code is 302.
  *
  * @see {@link https://hono.dev/docs/api/context#redirect}
  *
  * @example
  * ```ts
  * app.get('/redirect', (c) => {
  *   return c.redirect('/')
  * })
  * app.get('/redirect-permanently', (c) => {
  *   return c.redirect('/', 301)
  * })
  * ```
  */
  redirect = (location, status) => {
    const locationString = String(location);
    this.header("Location", !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString));
    return this.newResponse(null, status ?? 302);
  };
  /**
  * `.notFound()` can return the Not Found Response.
  *
  * @see {@link https://hono.dev/docs/api/context#notfound}
  *
  * @example
  * ```ts
  * app.get('/notfound', (c) => {
  *   return c.notFound()
  * })
  * ```
  */
  notFound = () => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  };
};

// node_modules/hono/dist/compose.js
var compose = (middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) throw new Error("next() called multiple times");
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else handler = i === middleware.length && next || void 0;
      if (handler) try {
        res = await handler(context, () => dispatch(i + 1));
      } catch (err) {
        if (err instanceof Error && onError) {
          context.error = err;
          res = await onError(err, context);
          isError = true;
        } else throw err;
      }
      else if (context.finalized === false && onNotFound) res = await onNotFound(context);
      if (res && (context.finalized === false || isError)) context.res = res;
      return context;
    }
  };
};

// node_modules/hono/dist/helper/route/index.js
var matchedRoutes = (c) => c.req[GET_MATCH_RESULT][0].map(([[, route]]) => route);
var routePath = (c, index) => matchedRoutes(c).at(index ?? c.req.routeIndex)?.path ?? "";

// node_modules/hono/dist/router.js
var METHODS = [
  "get",
  "post",
  "put",
  "delete",
  "options",
  "patch",
  "query"
];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
};

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/utils/mount.js
var countTrailingSlashes = (path) => {
  let index = path.length;
  while (index > 0 && path.charCodeAt(index - 1) === 47) index--;
  return path.length - index;
};
var getPathPrefixLength = (c, pathPrefix, routePath2) => {
  if (!/[:*]/.test(pathPrefix)) return pathPrefix.length;
  const path = c.req.path;
  const matchResult = c.req[GET_MATCH_RESULT];
  const paramNames = /* @__PURE__ */ new Set();
  let length = 0;
  for (const part of splitRoutingPath(pathPrefix)) {
    if (part[0] === ":" && part.endsWith("}?")) throw new Error(`mount(): Optional regular expression parameters are not supported in "${routePath2}".`);
    const pattern = getPattern(part);
    if (pattern && pattern !== "*") {
      const name = pattern[1];
      if (paramNames.has(name)) throw new Error(`mount(): Duplicate path parameter "${name}" in "${routePath2}".`);
      paramNames.add(name);
    }
    if (pattern && pattern !== "*" && pattern[2] !== true) {
      const value = matchResult.length === 2 ? matchResult[1][matchResult[0][c.req.routeIndex][1][pattern[1]]] : matchResult[0][c.req.routeIndex][1][pattern[1]];
      length += value.length + 1;
    } else if (pattern || part.endsWith("*")) {
      const end = path.indexOf("/", length + 1);
      length = end === -1 ? path.length : end;
    } else length += part.length + 1;
  }
  return length;
};
var createMountedRequest = (c, pathPrefix, routePath2) => {
  if (/[^/]\*$/.test(routePath2)) throw new Error(`mount(): Wildcard must follow "/" in "${routePath2}".`);
  const prefixLength = getPathPrefixLength(c, pathPrefix, routePath2);
  const path = c.req.path.slice(prefixLength) || "/";
  if (prefixLength > c.req.path.length || path[0] !== "/" || /\/(?:\.|%2e){1,2}(?:\/|$)/i.test(path)) throw new HTTPException(400, { message: "Invalid mounted path" });
  const rawUrl = c.req.raw.url;
  if (/^[^/?#]*\/\/[^/?#\\]*[?#\\]/.test(rawUrl)) throw new HTTPException(400, { message: "Invalid mounted path" });
  const rawPathEnd = rawUrl.search(/[?#]/);
  const rawTrailingSlashes = countTrailingSlashes(rawPathEnd === -1 ? rawUrl : rawUrl.slice(0, rawPathEnd));
  if (rawTrailingSlashes > 1 && countTrailingSlashes(c.req.path) === rawTrailingSlashes - 1) throw new HTTPException(400, { message: "Invalid mounted path" });
  const url = new URL(rawUrl);
  url.pathname = path.replace(/[\\\t\n\r]/g, encodeURIComponent);
  if (path.includes("%")) {
  }
  return new Request(url, c.req.raw);
};

// node_modules/hono/dist/hono-base.js
var notFoundHandler = (c) => {
  return c.text("404 Not Found", 404);
};
var errorHandler = (err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
};
var Hono = class Hono2 {
  get;
  post;
  put;
  delete;
  options;
  patch;
  query;
  all;
  on;
  use;
  router;
  getPath;
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    [...METHODS, "all"].forEach((method) => {
      this[method] = (args1, ...args) => {
        const methodName = method.toUpperCase();
        if (typeof args1 === "string") this.#path = args1;
        else this.#addRoute(methodName, this.#path, args1);
        args.forEach((handler) => {
          this.#addRoute(methodName, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          const methodName = m.toUpperCase();
          for (const handler of handlers) this.#addRoute(methodName, this.#path, handler);
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") this.#path = arg1;
      else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute("ALL", this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new Hono2({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  errorHandler = errorHandler;
  /**
  * `.route()` allows grouping other Hono instance in routes.
  *
  * @see {@link https://hono.dev/docs/api/routing#grouping}
  *
  * @param {string} path - base Path
  * @param {Hono} app - other Hono instance
  * @returns {Hono} routed Hono instance
  *
  * @example
  * ```ts
  * const app = new Hono()
  * const app2 = new Hono()
  *
  * app2.get("/user", (c) => c.text("user"))
  * app.route("/api", app2) // GET /api/user
  * ```
  */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) handler = r.handler;
      else {
        handler = async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res;
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler, r.basePath);
    });
    return this;
  }
  /**
  * `.basePath()` allows base paths to be specified.
  *
  * @see {@link https://hono.dev/docs/api/routing#base-path}
  *
  * @param {string} path - base Path
  * @returns {Hono} changed Hono instance
  *
  * @example
  * ```ts
  * const api = new Hono().basePath('/api')
  * ```
  */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
  * `.onError()` handles an error and returns a customized Response.
  *
  * @see {@link https://hono.dev/docs/api/hono#error-handling}
  *
  * @param {ErrorHandler} handler - request Handler for error
  * @returns {Hono} changed Hono instance
  *
  * @example
  * ```ts
  * app.onError((err, c) => {
  *   console.error(`${err}`)
  *   return c.text('Custom Error Message', 500)
  * })
  * ```
  */
  onError = (handler) => {
    this.errorHandler = handler;
    return this;
  };
  /**
  * `.notFound()` allows you to customize a Not Found Response.
  *
  * @see {@link https://hono.dev/docs/api/hono#not-found}
  *
  * @param {NotFoundHandler} handler - request handler for not-found
  * @returns {Hono} changed Hono instance
  *
  * @example
  * ```ts
  * app.notFound((c) => {
  *   return c.text('Custom 404 Message', 404)
  * })
  * ```
  */
  notFound = (handler) => {
    this.#notFoundHandler = handler;
    return this;
  };
  /**
  * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
  *
  * @deprecated Use `mount()` from `hono/mount` instead. `.mount()` will be removed in v5.
  *
  * @see {@link https://hono.dev/docs/api/hono#mount}
  *
  * @param {string} path - base Path
  * @param {Function} applicationHandler - other Request Handler
  * @param {MountOptions} [options] - options of `.mount()`
  * @returns {Hono} mounted Hono instance
  * @throws {Error} If automatic request rewriting encounters duplicate path parameter names or an optional regular expression parameter.
  * @throws {HTTPException} With status 400 if automatic request rewriting cannot safely preserve the routed path.
  *
  * @example
  * ```ts
  * import { Router as IttyRouter } from 'itty-router'
  * import { Hono } from 'hono'
  * // Create itty-router application
  * const ittyRouter = IttyRouter()
  * // GET /itty-router/hello
  * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
  *
  * const app = new Hono()
  * app.mount('/itty-router', ittyRouter.handle)
  * ```
  *
  * @example
  * ```ts
  * const app = new Hono()
  * // Send the request to another application without modification.
  * app.mount('/app', anotherApp, {
  *   replaceRequest: (req) => req,
  * })
  * ```
  */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") optionHandler = options;
      else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) replaceRequest = (request) => request;
        else replaceRequest = options.replaceRequest;
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    const defaultReplaceRequest = (c) => {
      const mountedRoutePath = routePath(c);
      return createMountedRequest(c, mountedRoutePath.replace(/\/?\*$/, ""), mountedRoutePath);
    };
    const handler = async (c, next) => {
      const res = await applicationHandler(replaceRequest ? replaceRequest(c.req.raw) : defaultReplaceRequest(c), ...getOptions(c));
      if (res) return res;
      await next();
    };
    this.#addRoute("ALL", mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler, baseRoutePath) {
    path = mergePath(this._basePath, path);
    const r = {
      basePath: baseRoutePath !== void 0 ? mergePath(this._basePath, baseRoutePath) : this._basePath,
      path,
      method,
      handler
    };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) return this.errorHandler(err, c);
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then((resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) throw new Error("Context is not finalized. Did you forget to return a Response object or `await next()`?");
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
  * `.fetch()` will be entry point of your app.
  *
  * @see {@link https://hono.dev/docs/api/hono#fetch}
  *
  * @param {Request} request - request Object of request
  * @param {Env} env - env Object
  * @param {ExecutionContext} executionCtx - context of execution
  * @returns {Response | Promise<Response>} response of request
  *
  */
  fetch = (request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  };
  /**
  * `.request()` is a useful method for testing.
  * You can pass a URL or pathname to send a GET request.
  * app will return a Response object.
  * ```ts
  * test('GET /hello is ok', async () => {
  *   const res = await app.request('/hello')
  *   expect(res.status).toBe(200)
  * })
  * ```
  * @see https://hono.dev/docs/api/hono#request
  */
  request = (input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    input = input.toString();
    return this.fetch(new Request(/^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`, requestInit), Env, executionCtx);
  };
  /**
  * `.fire()` automatically adds a global fetch event listener.
  * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
  * @deprecated
  * Use `fire` from `hono/service-worker` instead.
  * ```ts
  * import { Hono } from 'hono'
  * import { fire } from 'hono/service-worker'
  *
  * const app = new Hono()
  * // ...
  * fire(app)
  * ```
  * @see https://hono.dev/docs/api/hono#fire
  * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
  * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
  */
  fire = () => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  };
};

// node_modules/hono/dist/router/utils.js
var createNullObject = () => /* @__PURE__ */ Object.create(null);

// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = ((method2, path2) => {
    const matcher = matchers[method2] || matchers["ALL"];
    const staticMatch = matcher[2][path2];
    if (staticMatch) return staticMatch;
    const match3 = path2.match(matcher[0]);
    if (!match3) return [[], emptyParam];
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  });
  this.match = match2;
  return match2(method, path);
}

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = "[^]*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/[^]*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = /* @__PURE__ */ new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) return b.length === 1 ? a < b ? -1 : 1 : -1;
  if (b.length === 1) return 1;
  if (a === "[^]*" || a === "(?:|/[^]*)") return b === "[^]*" ? -1 : 1;
  else if (b === "[^]*" || b === "(?:|/[^]*)") return -1;
  if (a === "[^/]+") return 1;
  else if (b === "[^/]+") return -1;
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
var Node = class Node2 {
  #index;
  #varIndex;
  #children = createNullObject();
  insert(tokens, index, paramMap, context, keys) {
    let node = this;
    for (let i = 0, len = tokens.length; i < len; i++) {
      const token = tokens[i];
      const pattern = token.length === 1 ? token === "*" ? i === len - 1 ? [
        "",
        "",
        ONLY_WILDCARD_REG_EXP_STR
      ] : [
        "",
        "",
        LABEL_REG_EXP_STR
      ] : null : token === "/*" ? [
        "",
        "",
        TAIL_WILDCARD_REG_EXP_STR
      ] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
      let nextNode;
      if (pattern) {
        const name = pattern[1];
        let regexpStr = pattern[2] || "[^/]+";
        if (name && pattern[2]) {
          if (new RegExp(regexpStr).test("")) throw PATH_ERROR;
          regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
          if (/\((?!\?:)/.test(regexpStr)) throw PATH_ERROR;
          if (regexpStr.length === 1 && regExpMetaChars.has(regexpStr)) throw PATH_ERROR;
        }
        keys.push(regexpStr);
        nextNode = node.#children[regexpStr];
        if (!nextNode) {
          if (regexpStr !== "[^]*" && regexpStr !== "(?:|/[^]*)") {
            for (const k in node.#children) if ((regexpStr.length > 1 || k.length > 1) && k !== "[^]*" && k !== "(?:|/[^]*)") throw PATH_ERROR;
          }
          nextNode = node.#children[regexpStr] = new Node2();
        }
        if (name !== "") {
          nextNode.#varIndex ??= context.varIndex++;
          paramMap.push([name, nextNode.#varIndex]);
        }
      } else {
        keys.push(token);
        nextNode = node.#children[token];
        if (!nextNode) {
          for (const k in node.#children) if (k.length > 1 && k !== "[^]*" && k !== "(?:|/[^]*)") throw PATH_ERROR;
          nextNode = node.#children[token] = new Node2();
        }
      }
      node = nextNode;
    }
    if (node.#index !== void 0) throw PATH_ERROR;
    node.#index = index;
  }
  buildRegExpStr() {
    const strList = Object.keys(this.#children).sort(compareKey).map((k) => {
      const c = this.#children[k];
      const childStr = c.buildRegExpStr();
      return childStr === "" ? "" : (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + childStr;
    }).filter(Boolean);
    if (typeof this.#index === "number" && this.#index !== -1) strList.unshift(`#${this.#index}`);
    if (strList.length === 0) return "";
    if (strList.length === 1) return strList[0];
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  #context = { varIndex: 0 };
  #root = new Node();
  #index = 0;
  paths = createNullObject();
  insert(path, isStatic) {
    const keys = [];
    if (isStatic) {
      this.#root.insert(path.split(""), -1, [], this.#context, keys);
      this.paths[path] = [
        -1,
        [],
        keys
      ];
      return;
    }
    const paramAssoc = [];
    const groups = [];
    let markedPath = path;
    for (let i = 0; ; ) {
      let replaced = false;
      markedPath = markedPath.replace(/\{(?:\{[\d,]+\}|[^}])+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) break;
    }
    const tokens = markedPath.match(/(?::[^\/]+)|(?:\/\*$)|./gs) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) if (tokens[j].indexOf(mark) !== -1) {
        tokens[j] = tokens[j].replace(mark, groups[i][1]);
        break;
      }
    }
    this.#root.insert(tokens, this.#index, paramAssoc, this.#context, keys);
    this.paths[path] = [
      this.#index++,
      paramAssoc,
      keys
    ];
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") return [
      /^$/,
      [],
      []
    ];
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [
      new RegExp(`^${regexp}`),
      indexReplacementMap,
      paramReplacementMap
    ];
  }
};

// node_modules/hono/dist/router/reg-exp-router/router.js
function endsWithWildcard(keys) {
  const tail = keys[keys.length - 1];
  return tail === "[^]*" || tail === "(?:|/[^]*)";
}
function covers(wildcard, target) {
  const last = wildcard.length - 1;
  for (let i = 0; i < last; i++) if (wildcard[i] !== target[i]) return false;
  return wildcard[last] === "[^]*" || target.length === last || target[last] === "/";
}
var RegExpRouter = class {
  name = "RegExpRouter";
  #handlers;
  #tries;
  constructor() {
    this.#handlers = { ["ALL"]: [] };
    this.#tries = { ["ALL"]: new Trie() };
  }
  #insertPath(method, path) {
    try {
      this.#tries[method].insert(path, !/\*|\/:/.test(path));
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
  }
  add(method, path, handler) {
    const handlers = this.#handlers;
    if (!handlers) throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    const tries = this.#tries;
    if (!handlers[method]) {
      tries[method] = new Trie();
      handlers[method] = [...handlers["ALL"]];
      for (const p in tries["ALL"].paths) this.#insertPath(method, p);
    }
    if (path === "/*") path = "*";
    const methods = method === "ALL" ? Object.keys(handlers) : [method];
    const paths = checkOptionalParameter(path) || [path];
    for (const path2 of paths) for (const m of methods) {
      if (!tries[m].paths[path2]) this.#insertPath(m, path2);
      handlers[m].push([handler, path2]);
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = createNullObject();
    for (const method of Object.keys(this.#handlers)) matchers[method] = this.#buildMatcher(method);
    this.#handlers = this.#tries = void 0;
    return matchers;
  }
  #buildMatcher(method) {
    const handlers = this.#handlers[method];
    const trie = this.#tries[method];
    const staticMap = createNullObject();
    const handlerData = [];
    const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
    const own = createNullObject();
    const entries = handlers.map(([h, p], i) => {
      (own[p] ??= []).push(i);
      return [h, trie.paths[p][1].reduceRight((map, [key, varIndex]) => {
        map[key] = paramReplacementMap[varIndex];
        return map;
      }, createNullObject())];
    });
    const wildcards = Object.keys(own).filter((p) => endsWithWildcard(trie.paths[p][2]));
    for (const path in trie.paths) {
      const [index, , keys] = trie.paths[path];
      const indexes = [...own[path]];
      for (const p of wildcards) if (p !== path && covers(trie.paths[p][2], keys)) indexes.push(...own[p]);
      const data = indexes.sort((a, b) => a - b).map((i) => entries[i]);
      if (index === -1) {
        const last = Math.max(-1, ...data.flatMap(([, map]) => Object.values(map)));
        staticMap[path] = [data, last === -1 ? emptyParam : path.match(regexp).slice(0, last + 1)];
      } else handlerData[index] = data;
    }
    return [
      regexp,
      indexReplacementMap.map((i) => handlerData[i]),
      staticMap
    ];
  }
};

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    this.#routes.push([
      method,
      path,
      handler
    ]);
  }
  match(method, path) {
    if (!this.#routes) throw new Error("Fatal error");
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) router.add(...routes[i2]);
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) continue;
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) throw new Error("Fatal error");
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) throw new Error("No active router has been determined yet.");
    return this.#routers[0];
  }
};

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = createNullObject();
var order = 0;
var Node3 = class Node4 {
  #methods = [];
  #children = createNullObject();
  #patterns = [];
  #pattern;
  #params = emptyParams;
  insert(method, path, handler) {
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = /* @__PURE__ */ new Set();
    let i = 0;
    for (const p of parts) {
      const nextP = parts[++i];
      const pattern = getPattern(p, nextP) || (nextP === void 0 && p && p.indexOf("*") === p.length - 1 ? p : null);
      const isParam = Array.isArray(pattern);
      const key = isParam ? pattern[0] : pattern || p;
      const child = curNode.#children[key] ||= new Node4();
      if (pattern && !child.#pattern) {
        child.#pattern = pattern;
        curNode.#patterns.push(child);
      }
      curNode = child;
      if (isParam) possibleKeys.add(pattern[1]);
    }
    curNode.#methods.push({ [method]: {
      handler,
      possibleKeys: [...possibleKeys],
      score: ++order
    } });
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m["ALL"];
      if (handlerSet) {
        handlerSet.params = createNullObject();
        handlerSets.push(handlerSet);
        for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
          const key = handlerSet.possibleKeys[i2];
          handlerSet.params[key] = params?.[key] && !i2 ? params[key] : nodeParams[key] ?? params?.[key];
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    let curNodes = [this];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else tempNodes.push(nextNode);
        }
        for (const child of node.#patterns) {
          const pattern = child.#pattern;
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (typeof pattern === "string") {
            if (pattern === "*" || part.startsWith(pattern.slice(0, -1))) {
              this.#pushHandlerSets(handlerSets, child, method, node.#params);
              if (pattern === "*") {
                child.#params = params;
                tempNodes.push(child);
              }
            }
            continue;
          }
          const [, name, matcher] = pattern;
          if (!part && matcher === true) continue;
          if (matcher !== true) {
            if (!partOffsets) {
              partOffsets = [];
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.slice(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              if (!Object.hasOwn(params, name)) params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (m[0].length === restPathString.length && child.#children["*"]) this.#pushHandlerSets(handlerSets, child.#children["*"], method, node.#params, params);
              for (const _ in child.#children) {
                child.#params = params;
                const componentCount = m[0].match(/\//g)?.length ?? 0;
                (curNodesQueue[componentCount] ||= []).push(child);
                break;
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            if (!Object.hasOwn(params, name)) params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) this.#pushHandlerSets(handlerSets, child.#children["*"], method, params, node.#params);
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets[1]) handlerSets.sort((a, b) => {
      return a.score - b.score;
    });
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  name = "TrieRouter";
  #node = new Node3();
  add(method, path, handler) {
    for (const result of checkOptionalParameter(path) || [path]) this.#node.insert(method, result, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// node_modules/hono/dist/hono.js
var Hono3 = class extends Hono {
  /**
  * Creates an instance of the Hono class.
  *
  * @param options - Optional configuration options for the Hono instance.
  */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({ routers: [new RegExpRouter(), new TrieRouter()] });
  }
};

// node_modules/hono/dist/middleware/cors/index.js
var cors = (options) => {
  const opts = {
    origin: "*",
    allowMethods: [
      "GET",
      "HEAD",
      "PUT",
      "POST",
      "DELETE",
      "PATCH",
      "QUERY"
    ],
    allowHeaders: [],
    exposeHeaders: [],
    ...options
  };
  const exposeHeadersStr = opts.exposeHeaders?.length ? opts.exposeHeaders.join(",") : void 0;
  const allowHeadersStr = opts.allowHeaders?.length ? opts.allowHeaders.join(",") : void 0;
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") return () => optsOrigin;
      else return (origin) => optsOrigin === origin ? origin : null;
    } else if (typeof optsOrigin === "function") return optsOrigin;
    else return (origin) => optsOrigin.includes(origin) ? origin : null;
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") return async (origin, c) => (await optsAllowMethods(origin, c)).join(",");
    else if (Array.isArray(optsAllowMethods)) {
      const methodsStr = optsAllowMethods.join(",");
      return () => methodsStr;
    } else return () => "";
  })(opts.allowMethods);
  return async function cors2(c, next) {
    function set(key, value) {
      c.res.headers.set(key, value);
    }
    const allowOrigin = await findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin) set("Access-Control-Allow-Origin", allowOrigin);
    if (opts.credentials) set("Access-Control-Allow-Credentials", "true");
    if (exposeHeadersStr) set("Access-Control-Expose-Headers", exposeHeadersStr);
    if (c.req.method === "OPTIONS") {
      if (opts.origin !== "*") c.res.headers.append("Vary", "Origin");
      if (opts.maxAge != null) set("Access-Control-Max-Age", opts.maxAge.toString());
      const allowMethods = await findAllowMethods(c.req.header("origin") || "", c);
      if (allowMethods) set("Access-Control-Allow-Methods", allowMethods);
      let headersStr = allowHeadersStr;
      if (!headersStr) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) headersStr = requestHeaders.split(",").map((h) => h.trim()).join(",");
      }
      if (headersStr) {
        set("Access-Control-Allow-Headers", headersStr);
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*") c.header("Vary", "Origin", { append: true });
  };
};

// node_modules/hono/dist/middleware/secure-headers/secure-headers.js
var HEADERS_MAP = {
  crossOriginEmbedderPolicy: ["Cross-Origin-Embedder-Policy", "require-corp"],
  crossOriginResourcePolicy: ["Cross-Origin-Resource-Policy", "same-origin"],
  crossOriginOpenerPolicy: ["Cross-Origin-Opener-Policy", "same-origin"],
  originAgentCluster: ["Origin-Agent-Cluster", "?1"],
  referrerPolicy: ["Referrer-Policy", "no-referrer"],
  strictTransportSecurity: ["Strict-Transport-Security", "max-age=15552000; includeSubDomains"],
  xContentTypeOptions: ["X-Content-Type-Options", "nosniff"],
  xDnsPrefetchControl: ["X-DNS-Prefetch-Control", "off"],
  xDownloadOptions: ["X-Download-Options", "noopen"],
  xFrameOptions: ["X-Frame-Options", "SAMEORIGIN"],
  xPermittedCrossDomainPolicies: ["X-Permitted-Cross-Domain-Policies", "none"],
  xXssProtection: ["X-XSS-Protection", "0"]
};
var DEFAULT_OPTIONS = {
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: true,
  crossOriginOpenerPolicy: true,
  originAgentCluster: true,
  referrerPolicy: true,
  strictTransportSecurity: true,
  xContentTypeOptions: true,
  xDnsPrefetchControl: true,
  xDownloadOptions: true,
  xFrameOptions: true,
  xPermittedCrossDomainPolicies: true,
  xXssProtection: true,
  removePoweredBy: true,
  permissionsPolicy: {}
};
var secureHeaders = (customOptions) => {
  const options = {
    ...DEFAULT_OPTIONS,
    ...customOptions
  };
  const headersToSet = getFilteredHeaders(options);
  const callbacks = [];
  if (options.contentSecurityPolicy) {
    const [callback, value] = getCSPDirectives(options.contentSecurityPolicy, "Content-Security-Policy");
    if (callback) callbacks.push(callback);
    headersToSet.push(["Content-Security-Policy", value]);
  }
  if (options.contentSecurityPolicyReportOnly) {
    const [callback, value] = getCSPDirectives(options.contentSecurityPolicyReportOnly, "Content-Security-Policy-Report-Only");
    if (callback) callbacks.push(callback);
    headersToSet.push(["Content-Security-Policy-Report-Only", value]);
  }
  if (options.permissionsPolicy && Object.keys(options.permissionsPolicy).length > 0) headersToSet.push(["Permissions-Policy", getPermissionsPolicyDirectives(options.permissionsPolicy)]);
  if (options.reportingEndpoints) headersToSet.push(["Reporting-Endpoints", getReportingEndpoints(options.reportingEndpoints)]);
  if (options.reportTo) headersToSet.push(["Report-To", getReportToOptions(options.reportTo)]);
  return async function secureHeaders2(ctx, next) {
    const headersToSetForReq = callbacks.length === 0 ? headersToSet : callbacks.reduce((acc, cb) => cb(ctx, acc), headersToSet);
    await next();
    setHeaders(ctx, headersToSetForReq);
    if (options?.removePoweredBy) ctx.res.headers.delete("X-Powered-By");
  };
};
function getFilteredHeaders(options) {
  return Object.entries(HEADERS_MAP).filter(([key]) => options[key]).map(([key, defaultValue]) => {
    const overrideValue = options[key];
    return typeof overrideValue === "string" ? [defaultValue[0], overrideValue] : defaultValue;
  });
}
function getCSPDirectives(contentSecurityPolicy, headerName) {
  const callbacks = [];
  const resultValues = [];
  for (const [directive, value] of Object.entries(contentSecurityPolicy)) {
    const valueArray = Array.isArray(value) ? value : [value];
    valueArray.forEach((value2, i) => {
      if (typeof value2 === "function") {
        const index = i * 2 + 2 + resultValues.length;
        callbacks.push((ctx, values) => {
          values[index] = value2(ctx, directive);
        });
      }
    });
    resultValues.push(directive.replace(/[A-Z]+(?![a-z])|[A-Z]/g, (match2, offset) => offset ? "-" + match2.toLowerCase() : match2.toLowerCase()), ...valueArray.flatMap((value2) => [" ", value2]), "; ");
  }
  resultValues.pop();
  return callbacks.length === 0 ? [void 0, resultValues.join("")] : [(ctx, headersToSet) => headersToSet.map((values) => {
    if (values[0] === headerName) {
      const clone = values[1].slice();
      callbacks.forEach((cb) => {
        cb(ctx, clone);
      });
      return [values[0], clone.join("")];
    } else return values;
  }), resultValues];
}
function getPermissionsPolicyDirectives(policy) {
  return Object.entries(policy).map(([directive, value]) => {
    const kebabDirective = camelToKebab(directive);
    if (typeof value === "boolean") return `${kebabDirective}=${value ? "*" : "()"}`;
    if (Array.isArray(value)) {
      if (value.length === 0) return `${kebabDirective}=()`;
      if (value.length === 1 && value[0] === "*") return `${kebabDirective}=*`;
      if (value.length === 1 && value[0] === "none") return `${kebabDirective}=()`;
      return `${kebabDirective}=(${value.map((item) => ["self", "src"].includes(item) ? item : `"${item}"`).join(" ")})`;
    }
    return "";
  }).filter(Boolean).join(", ");
}
function camelToKebab(str) {
  return str.replace(/([a-z\d])([A-Z])/g, "$1-$2").toLowerCase();
}
function getReportingEndpoints(reportingEndpoints = []) {
  return reportingEndpoints.map((endpoint) => `${endpoint.name}="${endpoint.url}"`).join(", ");
}
function getReportToOptions(reportTo = []) {
  return reportTo.map((option) => JSON.stringify(option)).join(", ");
}
function setHeaders(ctx, headersToSet) {
  headersToSet.forEach(([header, value]) => {
    ctx.res.headers.set(header, value);
  });
}

// src/worker/db/d1Client.ts
var D1Client = class {
  db;
  constructor(db) {
    if (!db) {
      throw new Error(
        '[STROOM D1 Safety] Database binding "DB" is not configured or undefined. Strict fallback prevention: connection to physical SQLite files is prohibited.'
      );
    }
    this.db = db;
  }
  /**
   * Prepares a SQL statement with parameterized bindings.
   * STRICT SAFETY: Enforces parameter binding; rejects undefined bindings.
   */
  prepare(query, ...params) {
    const stmt = this.db.prepare(query);
    if (params.length > 0) {
      return stmt.bind(...params);
    }
    return stmt;
  }
  /**
   * Executes a read query returning the first matching row, or null if empty.
   */
  async first(query, ...params) {
    try {
      const stmt = this.prepare(query, ...params);
      const row = await stmt.first();
      return row ?? null;
    } catch (err) {
      this.handleError("first", err);
    }
  }
  /**
   * Executes a read query returning all matching rows.
   */
  async all(query, ...params) {
    try {
      const stmt = this.prepare(query, ...params);
      const res = await stmt.all();
      return res.results ?? [];
    } catch (err) {
      this.handleError("all", err);
    }
  }
  /**
   * Executes a write or mutation statement (INSERT, UPDATE, DELETE).
   */
  async run(query, ...params) {
    try {
      const stmt = this.prepare(query, ...params);
      return await stmt.run();
    } catch (err) {
      this.handleError("run", err);
    }
  }
  /**
   * Executes an atomic batch of prepared statements in a single transaction.
   */
  async batch(statements) {
    if (!statements || statements.length === 0) {
      return [];
    }
    if (statements.length > 50) {
      throw new Error("[STROOM D1 Safety] D1 batch limit exceeded: maximum 50 statements allowed per batch.");
    }
    try {
      return await this.db.batch(statements);
    } catch (err) {
      this.handleError("batch", err);
    }
  }
  /**
   * Safe read-only health probe query.
   */
  async probeHealth() {
    try {
      const res = await this.db.prepare("SELECT 1 as probe, datetime('now') as ts").first();
      return {
        ok: res?.probe === 1,
        timestamp: res?.ts || (/* @__PURE__ */ new Date()).toISOString()
      };
    } catch {
      return {
        ok: false,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
  }
  /**
   * Retrieves the count of application tables in D1 (excluding SQLite internal and migration tables).
   */
  async getApplicationTableCount() {
    try {
      const res = await this.db.prepare(
        "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE '_internal_%' AND name != 'd1_migrations'"
      ).first();
      return Number(res?.count ?? 0);
    } catch {
      return 0;
    }
  }
  /**
   * Sanitized error handling preventing internal path or credential leakage.
   */
  handleError(operation, error) {
    const rawMessage = error?.message || "Database error occurred";
    const sanitized = rawMessage.replace(/[a-zA-Z]:\\[^ \n\r\t]+/g, "[REDACTED_PATH]");
    throw new Error(`[D1 Operation Error: ${operation}] ${sanitized}`);
  }
};
function createD1Client(db) {
  return new D1Client(db);
}

// src/worker/routes/health.ts
var healthRouter = new Hono3();
healthRouter.get("/health", async (c) => {
  const startTime = Date.now();
  let d1Status = "disconnected";
  let d1ProbeOk = false;
  let applicationTableCount = 0;
  if (c.env?.DB) {
    try {
      const d1 = createD1Client(c.env.DB);
      const probe = await d1.probeHealth();
      d1ProbeOk = probe.ok;
      applicationTableCount = await d1.getApplicationTableCount();
      d1Status = probe.ok ? "connected" : "degraded";
    } catch {
      d1Status = "error";
    }
  } else {
    d1Status = "unconfigured";
  }
  const isHealthy = d1ProbeOk && applicationTableCount === 42;
  return c.json(
    {
      status: isHealthy ? "healthy" : "degraded",
      service: "stroom-worker-api",
      runtime: "cloudflare-workers",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      latencyMs: Date.now() - startTime,
      database: {
        binding: "DB",
        type: "cloudflare-d1",
        status: d1Status,
        applicationTables: applicationTableCount,
        schemaVerified: applicationTableCount === 42
      }
    },
    isHealthy ? 200 : 503
  );
});

// src/worker/utils/crypto.ts
var EXPECTED_SECRET_LENGTH = 43;
var MAX_ROTATION_OVERLAP_MS = 72 * 60 * 60 * 1e3;
function isStrictBase64UrlCharCode(code) {
  return code >= 65 && code <= 90 || // A-Z
  code >= 97 && code <= 122 || // a-z
  code >= 48 && code <= 57 || // 0-9
  code === 95 || // _
  code === 45;
}
function base64UrlDecode(str) {
  if (str.length !== EXPECTED_SECRET_LENGTH) return null;
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/") + "=";
  try {
    const binary = atob(base64);
    if (binary.length !== 32) return null;
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}
function base64UrlEncode(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function isCanonicalBase64Url32Worker(secret) {
  if (typeof secret !== "string") return false;
  if (secret.length !== EXPECTED_SECRET_LENGTH) return false;
  for (let i = 0; i < secret.length; i++) {
    if (!isStrictBase64UrlCharCode(secret.charCodeAt(i))) return false;
  }
  const decoded = base64UrlDecode(secret);
  if (!decoded || decoded.length !== 32) return false;
  return base64UrlEncode(decoded) === secret;
}
function validateBridgeSecretConfig(env) {
  const primary = env.INTERNAL_D1_BRIDGE_SECRET;
  if (!primary || !isCanonicalBase64Url32Worker(primary)) {
    return { valid: false, error: "Primary bridge secret is missing or non-canonical." };
  }
  const previous = env.INTERNAL_D1_BRIDGE_SECRET_PREVIOUS;
  const previousExpiresAt = env.INTERNAL_D1_BRIDGE_SECRET_PREVIOUS_EXPIRES_AT;
  if (previous) {
    if (!isCanonicalBase64Url32Worker(previous)) {
      return { valid: false, error: "Previous bridge secret is non-canonical." };
    }
    if (!previousExpiresAt) {
      return { valid: false, error: "Previous bridge secret expiry is missing." };
    }
    const expiresMs = Number(previousExpiresAt);
    if (isNaN(expiresMs) || expiresMs <= 0) {
      return { valid: false, error: "Previous bridge secret expiry is invalid timestamp." };
    }
  }
  return { valid: true };
}
async function timingSafeStringEqual(a, b) {
  const enc = new TextEncoder();
  const hashA = await crypto.subtle.digest("SHA-256", enc.encode(a));
  const hashB = await crypto.subtle.digest("SHA-256", enc.encode(b));
  const bufA = new Uint8Array(hashA);
  const bufB = new Uint8Array(hashB);
  let mismatch = 0;
  for (let i = 0; i < 32; i++) {
    mismatch |= bufA[i] ^ bufB[i];
  }
  return mismatch === 0;
}
async function verifyBridgeSecret(incomingSecret, env) {
  if (!isCanonicalBase64Url32Worker(incomingSecret)) {
    return { authorized: false, reason: "Malformed or non-canonical client secret." };
  }
  const primary = env.INTERNAL_D1_BRIDGE_SECRET;
  if (!primary) {
    return { authorized: false, reason: "Bridge secret not configured." };
  }
  if (await timingSafeStringEqual(incomingSecret, primary)) {
    return { authorized: true, matchedSecret: primary };
  }
  const previous = env.INTERNAL_D1_BRIDGE_SECRET_PREVIOUS;
  const previousExpiresAt = env.INTERNAL_D1_BRIDGE_SECRET_PREVIOUS_EXPIRES_AT;
  if (previous && previousExpiresAt) {
    const expiresMs = Number(previousExpiresAt);
    const now = Date.now();
    if (now >= expiresMs) {
      return { authorized: false, reason: "Previous bridge secret has expired." };
    }
    if (await timingSafeStringEqual(incomingSecret, previous)) {
      return { authorized: true, matchedSecret: previous };
    }
  }
  return { authorized: false, reason: "Bridge secret mismatch." };
}
async function verifyWorkerJwt(token, secret) {
  if (!token || typeof token !== "string") {
    return { valid: false, reason: "Missing token" };
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false, reason: "Malformed JWT structure" };
  }
  const [headerB64, payloadB64, signatureB64] = parts;
  let header;
  try {
    const headerJson = atob(headerB64.replace(/-/g, "+").replace(/_/g, "/"));
    header = JSON.parse(headerJson);
  } catch {
    return { valid: false, reason: "Invalid JWT header" };
  }
  if (header.alg !== "HS256") {
    return { valid: false, reason: `Unsupported algorithm: ${header.alg}` };
  }
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const data = enc.encode(`${headerB64}.${payloadB64}`);
    let sigBase64 = signatureB64.replace(/-/g, "+").replace(/_/g, "/");
    while (sigBase64.length % 4 !== 0) sigBase64 += "=";
    const sigBinary = atob(sigBase64);
    const sigBytes = new Uint8Array(sigBinary.length);
    for (let i = 0; i < sigBinary.length; i++) sigBytes[i] = sigBinary.charCodeAt(i);
    const isValidSig = await crypto.subtle.verify("HMAC", key, sigBytes, data);
    if (!isValidSig) {
      return { valid: false, reason: "Invalid JWT signature" };
    }
    let payloadBase64 = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    while (payloadBase64.length % 4 !== 0) payloadBase64 += "=";
    const payloadJson = atob(payloadBase64);
    const payload = JSON.parse(payloadJson);
    if (payload.exp && Math.floor(Date.now() / 1e3) >= payload.exp) {
      return { valid: false, reason: "JWT token has expired" };
    }
    return { valid: true, payload };
  } catch (err) {
    return { valid: false, reason: `JWT verification error: ${err.message}` };
  }
}
async function verifyMediaSecret(incomingSecret, env) {
  if (!isCanonicalBase64Url32Worker(incomingSecret)) {
    return { authorized: false, reason: "Malformed or non-canonical media secret." };
  }
  const primary = env.INTERNAL_MEDIA_SECRET;
  if (!primary) {
    return { authorized: false, reason: "Internal media secret not configured." };
  }
  if (await timingSafeStringEqual(incomingSecret, primary)) {
    return { authorized: true, matchedSecret: primary };
  }
  const previous = env.INTERNAL_MEDIA_SECRET_PREVIOUS;
  const previousExpiresAt = env.INTERNAL_MEDIA_SECRET_PREVIOUS_EXPIRES_AT;
  if (previous && previousExpiresAt) {
    const expiresMs = Number(previousExpiresAt);
    const now = Date.now();
    if (now >= expiresMs) {
      return { authorized: false, reason: "Previous media secret has expired." };
    }
    if (await timingSafeStringEqual(incomingSecret, previous)) {
      return { authorized: true, matchedSecret: previous };
    }
  }
  return { authorized: false, reason: "Internal media secret mismatch." };
}

// src/worker/middleware/bridgeAuth.ts
function bridgeAuthMiddleware() {
  return async (c, next) => {
    const configCheck = validateBridgeSecretConfig(c.env);
    if (!configCheck.valid) {
      return c.json(
        {
          error: "Internal Server Error",
          message: "Bridge secret configuration invalid or missing."
        },
        500
      );
    }
    const secretHeader = c.req.header("x-stroom-bridge-secret");
    const timestampHeader = c.req.header("x-stroom-timestamp");
    const nonceHeader = c.req.header("x-stroom-nonce");
    const signatureHeader = c.req.header("x-stroom-signature");
    if (!secretHeader || !timestampHeader || !nonceHeader || !signatureHeader) {
      return c.json(
        {
          error: "Unauthorized",
          message: "Missing required bridge authentication headers."
        },
        401
      );
    }
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(nonceHeader)) {
      return c.json(
        {
          error: "Unauthorized",
          message: "Malformed or invalid nonce format."
        },
        401
      );
    }
    if (!/^[a-f0-9]{64}$/i.test(signatureHeader)) {
      return c.json(
        {
          error: "Unauthorized",
          message: "Malformed signature format."
        },
        401
      );
    }
    const timestamp = Number(timestampHeader);
    if (isNaN(timestamp) || !Number.isInteger(timestamp)) {
      return c.json(
        {
          error: "Unauthorized",
          message: "Malformed timestamp format."
        },
        401
      );
    }
    const now = Date.now();
    if (Math.abs(now - timestamp) > 3e4) {
      return c.json(
        {
          error: "Unauthorized",
          message: "Timestamp drift exceeded (+/- 30s tolerance window)."
        },
        401
      );
    }
    const secretVerification = await verifyBridgeSecret(secretHeader, c.env);
    if (!secretVerification.authorized || !secretVerification.matchedSecret) {
      return c.json(
        {
          error: "Unauthorized",
          message: "Invalid, expired, or non-matching bridge secret."
        },
        401
      );
    }
    let buffer;
    try {
      buffer = await c.req.raw.arrayBuffer();
    } catch {
      return c.json({ error: "Bad Request", message: "Unable to read request body." }, 400);
    }
    const rawBodyBytes = new Uint8Array(buffer);
    const bodyDigestBuf = await crypto.subtle.digest("SHA-256", buffer);
    const bodyHash = Array.from(new Uint8Array(bodyDigestBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    let parsedBody;
    try {
      const decodedText = new TextDecoder("utf-8").decode(rawBodyBytes);
      parsedBody = JSON.parse(decodedText);
    } catch {
      return c.json(
        {
          error: "Bad Request",
          message: "Invalid JSON payload or non-UTF-8 encoding."
        },
        400
      );
    }
    if (!parsedBody || typeof parsedBody !== "object") {
      return c.json({ error: "Bad Request", message: "Payload must be a JSON object." }, 400);
    }
    const action = c.req.header("x-stroom-action") || parsedBody.action;
    if (!action || typeof action !== "string") {
      return c.json({ error: "Bad Request", message: "Missing action identifier." }, 400);
    }
    if (c.req.header("x-stroom-action") && parsedBody.action && c.req.header("x-stroom-action") !== parsedBody.action) {
      return c.json(
        {
          error: "Bad Request",
          message: "Action header mismatch with payload action."
        },
        400
      );
    }
    const sigPayload = `${timestamp}:${nonceHeader}:${action}:${bodyHash}`;
    const enc = new TextEncoder();
    const hmacKey = await crypto.subtle.importKey(
      "raw",
      enc.encode(secretVerification.matchedSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const expectedSigBuf = await crypto.subtle.sign("HMAC", hmacKey, enc.encode(sigPayload));
    const expectedSigHex = Array.from(new Uint8Array(expectedSigBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const sigMatches = await timingSafeStringEqual(
      signatureHeader.toLowerCase(),
      expectedSigHex.toLowerCase()
    );
    if (!sigMatches) {
      return c.json(
        {
          error: "Unauthorized",
          message: "HMAC signature verification failed (tampering or key mismatch)."
        },
        401
      );
    }
    c.set("bridgeContext", {
      timestamp,
      nonce: nonceHeader,
      action,
      rawBodyBytes,
      parsedBody,
      matchedSecret: secretVerification.matchedSecret
    });
    await next();
  };
}

// src/worker/routes/internalBridge.ts
var VALID_ROLES = [
  "super_admin",
  "admin",
  "platform_admin",
  "event_manager",
  "auctioneer",
  "auction_manager",
  "community_manager",
  "partner_manager",
  "checkin_staff",
  "support_staff",
  "venue_partner",
  "participant",
  "user"
];
var PRIVILEGED_ROLES = ["super_admin", "admin", "platform_admin"];
var ALLOWED_ACTIONS = [
  "getUserForLogin",
  "createUser",
  "updatePasswordHash",
  "changePassword",
  "changeAccountStatus",
  "updateUserRole"
];
var internalBridgeRouter = new Hono3();
internalBridgeRouter.use("/internal/d1/execute", bridgeAuthMiddleware());
internalBridgeRouter.post("/internal/d1/execute", async (c) => {
  const ctx = c.get("bridgeContext");
  if (!ctx) {
    return c.json({ error: "Unauthorized", message: "Bridge context missing." }, 401);
  }
  const { action, parsedBody, nonce } = ctx;
  const params = parsedBody.params || {};
  const actor = parsedBody.actor;
  if (!c.env.DB) {
    return c.json(
      {
        error: "Service Unavailable",
        message: "D1 database binding unreachable. Fail-closed."
      },
      503
    );
  }
  if (!ALLOWED_ACTIONS.includes(action)) {
    return c.json(
      {
        error: "Bad Request",
        message: `Unsupported or unallowlisted bridge action: ${action}`
      },
      400
    );
  }
  const now = Date.now();
  const nonceExpiresAt = now + 6e4;
  try {
    const prunePromise = c.env.DB.prepare(
      "DELETE FROM _internal_bridge_nonces WHERE expires_at < ?"
    ).bind(now - 6e4).run();
    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(prunePromise.catch(() => {
      }));
    } else {
      prunePromise.catch(() => {
      });
    }
  } catch {
  }
  const nonceStmt = c.env.DB.prepare(
    "INSERT INTO _internal_bridge_nonces (nonce, created_at, expires_at) VALUES (?, ?, ?)"
  ).bind(nonce, now, nonceExpiresAt);
  try {
    switch (action) {
      case "getUserForLogin": {
        const email = params.email;
        if (!email || typeof email !== "string") {
          return c.json({ error: "Bad Request", message: "Email parameter required." }, 400);
        }
        const normalizedEmail = email.trim().toLowerCase();
        const selectStmt = c.env.DB.prepare(
          `SELECT id, email, password_hash, full_name, avatar_url, role, account_status, onboarding_status, created_at, updated_at
           FROM users
           WHERE lower(email) = lower(?)`
        ).bind(normalizedEmail);
        const batchResults = await c.env.DB.batch([nonceStmt, selectStmt]);
        const selectResult = batchResults[1];
        const user = selectResult.results?.[0] || null;
        return c.json({
          success: true,
          action,
          user
        });
      }
      case "createUser": {
        const { id, email, password_hash, full_name, avatar_url } = params;
        if (!id || !email || !password_hash || !full_name) {
          return c.json(
            {
              error: "Bad Request",
              message: "Missing required parameters for createUser (id, email, password_hash, full_name)."
            },
            400
          );
        }
        const normalizedEmail = email.trim().toLowerCase();
        const defaultAvatar = avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(full_name.trim())}`;
        const insertStmt = c.env.DB.prepare(
          `INSERT INTO users (id, email, password_hash, full_name, avatar_url, role, onboarding_status)
           VALUES (?, ?, ?, ?, ?, 'user', 'NOT_STARTED')`
        ).bind(id, normalizedEmail, password_hash, full_name.trim(), defaultAvatar);
        try {
          await c.env.DB.batch([nonceStmt, insertStmt]);
          return c.json(
            {
              success: true,
              action,
              userId: id
            },
            201
          );
        } catch (dbErr) {
          const errMsg = String(dbErr?.message || "");
          if (errMsg.includes("_internal_bridge_nonces") && (errMsg.includes("UNIQUE") || errMsg.includes("PRIMARYKEY"))) {
            return c.json(
              {
                error: "Conflict",
                message: "Replay detected: nonce has already been consumed."
              },
              409
            );
          }
          if (errMsg.includes("users") && (errMsg.includes("UNIQUE") || errMsg.includes("constraint"))) {
            const existing = await c.env.DB.prepare(
              "SELECT id, email FROM users WHERE lower(email) = lower(?)"
            ).bind(normalizedEmail).first();
            if (existing && existing.id === id) {
              return c.json({
                success: true,
                action,
                userId: id,
                reconciled: true
              });
            }
            return c.json(
              {
                error: "Conflict",
                message: "An account with this email already exists.",
                code: "USER_EXISTS"
              },
              409
            );
          }
          throw dbErr;
        }
      }
      case "updatePasswordHash": {
        const { id, password_hash } = params;
        if (!id || !password_hash) {
          return c.json(
            { error: "Bad Request", message: "Missing parameters (id, password_hash)." },
            400
          );
        }
        const updateStmt = c.env.DB.prepare(
          "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(password_hash, id);
        const batchResults = await c.env.DB.batch([nonceStmt, updateStmt]);
        const updateResult = batchResults[1];
        return c.json({
          success: true,
          action,
          rowsUpdated: updateResult.meta?.changes ?? 1
        });
      }
      case "changePassword": {
        const { id, password_hash } = params;
        if (!id || !password_hash) {
          return c.json(
            { error: "Bad Request", message: "Missing parameters (id, password_hash)." },
            400
          );
        }
        const updateStmt = c.env.DB.prepare(
          "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(password_hash, id);
        const batchResults = await c.env.DB.batch([nonceStmt, updateStmt]);
        const updateResult = batchResults[1];
        return c.json({
          success: true,
          action,
          rowsUpdated: updateResult.meta?.changes ?? 1
        });
      }
      case "changeAccountStatus": {
        const { id, account_status } = params;
        if (!id || !account_status) {
          return c.json(
            { error: "Bad Request", message: "Missing parameters (id, account_status)." },
            400
          );
        }
        if (!["active", "suspended"].includes(account_status)) {
          return c.json(
            { error: "Bad Request", message: "Invalid account_status (active or suspended)." },
            400
          );
        }
        if (!actor || !actor.id || !actor.role) {
          return c.json(
            {
              error: "Forbidden",
              message: "Verified administrator actor context required for account status change."
            },
            403
          );
        }
        if (actor.id === id) {
          return c.json(
            { error: "Bad Request", message: "Cannot modify your own administrative account status." },
            400
          );
        }
        const target = await c.env.DB.prepare("SELECT id, role FROM users WHERE id = ?").bind(id).first();
        if (!target) {
          return c.json({ error: "Not Found", message: "Member not found." }, 404);
        }
        if (PRIVILEGED_ROLES.includes(target.role) && actor.role !== "super_admin") {
          return c.json(
            {
              error: "Forbidden",
              message: "Only a Super Admin can suspend or reactivate privileged administrator accounts."
            },
            403
          );
        }
        const updateStmt = c.env.DB.prepare(
          "UPDATE users SET account_status = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(account_status, id);
        const batchResults = await c.env.DB.batch([nonceStmt, updateStmt]);
        const updateResult = batchResults[1];
        return c.json({
          success: true,
          action,
          rowsUpdated: updateResult.meta?.changes ?? 1,
          memberId: id,
          account_status
        });
      }
      case "updateUserRole": {
        const { id, role } = params;
        if (!id || !role) {
          return c.json({ error: "Bad Request", message: "Missing parameters (id, role)." }, 400);
        }
        if (!VALID_ROLES.includes(role)) {
          return c.json(
            { error: "Bad Request", message: `Invalid role key: ${role}. Must be one of 13 official roles.` },
            400
          );
        }
        if (!actor || !actor.id || !actor.role) {
          return c.json(
            {
              error: "Forbidden",
              message: "Verified administrator actor context required for role assignment."
            },
            403
          );
        }
        if (actor.id === id) {
          return c.json(
            { error: "Bad Request", message: "Cannot alter your own administrative role." },
            400
          );
        }
        if ((PRIVILEGED_ROLES.includes(role) || actor.role !== "super_admin") && PRIVILEGED_ROLES.includes(role)) {
          if (actor.role !== "super_admin") {
            return c.json(
              {
                error: "Forbidden",
                message: "Forbidden: Only Super Admins can assign or modify privileged Admin roles."
              },
              403
            );
          }
        }
        const target = await c.env.DB.prepare("SELECT id, role FROM users WHERE id = ?").bind(id).first();
        if (!target) {
          return c.json({ error: "Not Found", message: "Member not found." }, 404);
        }
        if (PRIVILEGED_ROLES.includes(target.role) && actor.role !== "super_admin") {
          return c.json(
            {
              error: "Forbidden",
              message: "Forbidden: Only Super Admins can alter existing privileged Admin roles."
            },
            403
          );
        }
        const updateStmt = c.env.DB.prepare(
          "UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(role, id);
        const batchResults = await c.env.DB.batch([nonceStmt, updateStmt]);
        const updateResult = batchResults[1];
        return c.json({
          success: true,
          action,
          rowsUpdated: updateResult.meta?.changes ?? 1,
          memberId: id,
          role
        });
      }
      default:
        return c.json({ error: "Bad Request", message: `Unhandled action: ${action}` }, 400);
    }
  } catch (err) {
    const errMsg = String(err?.message || "");
    if (errMsg.includes("_internal_bridge_nonces") && (errMsg.includes("UNIQUE") || errMsg.includes("PRIMARYKEY"))) {
      return c.json(
        {
          error: "Conflict",
          message: "Replay detected: nonce has already been consumed."
        },
        409
      );
    }
    if (errMsg.includes("D1_ERROR") || errMsg.includes("storage") || errMsg.includes("network") || errMsg.includes("timeout")) {
      return c.json(
        {
          error: "Service Unavailable",
          message: "D1 database execution failure. Fail-closed."
        },
        503
      );
    }
    return c.json(
      {
        error: "Internal Server Error",
        message: "Internal bridge execution error."
      },
      500
    );
  }
});

// src/worker/routes/authProxy.ts
var authProxyRouter = new Hono3();
authProxyRouter.all("/auth/*", async (c) => {
  const originSecret = c.env.ORIGIN_PROXY_SECRET;
  if (!originSecret || !isCanonicalBase64Url32Worker(originSecret)) {
    return c.json(
      {
        error: "Internal Server Error",
        message: "Origin proxy secret configuration invalid or missing."
      },
      500
    );
  }
  const originUrl = c.env.ORIGIN_URL || "http://127.0.0.1:5000";
  const url = new URL(c.req.url);
  const targetPath = url.pathname.replace(/^\/api\/auth/, "/api/auth").replace(/^\/auth/, "/api/auth");
  const targetUrl = new URL(targetPath + url.search, originUrl);
  const forwardedHeaders = new Headers();
  c.req.raw.headers.forEach((val, key) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey === "x-stroom-origin-secret" || lowerKey === "x-stroom-bridge-secret") {
      return;
    }
    if (lowerKey === "host") {
      return;
    }
    forwardedHeaders.set(key, val);
  });
  forwardedHeaders.set("X-STROOM-Origin-Secret", originSecret);
  let body = void 0;
  if (!["GET", "HEAD"].includes(c.req.method.toUpperCase())) {
    try {
      body = await c.req.raw.arrayBuffer();
    } catch {
    }
  }
  try {
    const originResponse = await fetch(targetUrl.toString(), {
      method: c.req.method,
      headers: forwardedHeaders,
      body
    });
    const responseHeaders = new Headers(originResponse.headers);
    return new Response(originResponse.body, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers: responseHeaders
    });
  } catch (err) {
    return c.json(
      {
        error: "Bad Gateway",
        message: "Origin backend unreachable."
      },
      502
    );
  }
});

// src/worker/routes/media.ts
var mediaRouter = new Hono3();
var ALLOWED_MIME_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};
var MAX_FILE_SIZE = 5 * 1024 * 1024;
function validateMagicBytes(buffer, mimeType) {
  const normalizedMime = mimeType.toLowerCase();
  if (normalizedMime.includes("svg") || normalizedMime.includes("html") || normalizedMime.includes("xml") || normalizedMime.includes("javascript") || normalizedMime.includes("octet-stream")) {
    return {
      valid: false,
      reason: "SVG, HTML, XML, script, and raw binary uploads are strictly prohibited for security."
    };
  }
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 12) {
    return {
      valid: false,
      reason: "Payload is too small to contain valid image file headers."
    };
  }
  if (normalizedMime === "image/jpeg") {
    if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
      return { valid: true };
    }
    return {
      valid: false,
      reason: "File signature (magic bytes) does not match JPEG format (expected FF D8 FF)."
    };
  }
  if (normalizedMime === "image/png") {
    if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10) {
      return { valid: true };
    }
    return {
      valid: false,
      reason: "File signature (magic bytes) does not match PNG format (expected 89 50 4E 47...)."
    };
  }
  if (normalizedMime === "image/gif") {
    if (bytes[0] === 71 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 56 && (bytes[4] === 55 || bytes[4] === 57) && bytes[5] === 97) {
      return { valid: true };
    }
    return {
      valid: false,
      reason: "File signature (magic bytes) does not match GIF format (expected GIF87a or GIF89a)."
    };
  }
  if (normalizedMime === "image/webp") {
    if (bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70 && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80) {
      return { valid: true };
    }
    return {
      valid: false,
      reason: "File signature (magic bytes) does not match WebP RIFF/WEBP format."
    };
  }
  return { valid: false, reason: `Unsupported media type: ${mimeType}` };
}
async function authenticateUserJwt(c) {
  const serviceHeader = c.req.header("x-stroom-media-secret") || c.req.header("x-stroom-bridge-secret") || c.req.header("x-stroom-origin-secret");
  if (serviceHeader) {
    return {
      authenticated: false,
      reason: "Internal service credentials cannot be used as user authentication on public media endpoints."
    };
  }
  const authHeader = c.req.header("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return {
      authenticated: false,
      reason: "Authentication required. Please provide a valid Bearer token."
    };
  }
  const token = authHeader.substring(7).trim();
  const jwtSecret = c.env.JWT_SECRET;
  if (!jwtSecret) {
    return { authenticated: false, reason: "JWT authentication not configured on Worker." };
  }
  const result = await verifyWorkerJwt(token, jwtSecret);
  if (result.valid && result.payload) {
    return { authenticated: true, user: result.payload };
  }
  return { authenticated: false, reason: result.reason || "Invalid JWT token." };
}
async function authenticateInternalMediaService(c) {
  const authHeader = c.req.header("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    return {
      authorized: false,
      reason: "Browser or user credentials cannot invoke internal media endpoints."
    };
  }
  const bridgeHeader = c.req.header("x-stroom-bridge-secret");
  if (bridgeHeader) {
    return {
      authorized: false,
      reason: "D1 bridge credentials cannot be used for internal media operations. Dedicated internal media credential required."
    };
  }
  const originHeader = c.req.header("x-stroom-origin-secret");
  if (originHeader) {
    return {
      authorized: false,
      reason: "Origin proxy credentials cannot be used for internal media operations. Dedicated internal media credential required."
    };
  }
  const mediaSecret = c.req.header("x-stroom-media-secret");
  if (!mediaSecret) {
    return { authorized: false, reason: "Missing X-STROOM-Media-Secret header." };
  }
  const result = await verifyMediaSecret(mediaSecret, c.env);
  if (result.authorized) {
    return { authorized: true };
  }
  return { authorized: false, reason: result.reason || "Invalid internal media credential." };
}
mediaRouter.post("/media/upload", async (c) => {
  if (!c.env.MEDIA_BUCKET) {
    return c.json(
      {
        error: "Service Unavailable",
        message: "Cloudflare R2 Media Bucket is not configured or unavailable."
      },
      503
    );
  }
  const auth = await authenticateUserJwt(c);
  if (!auth.authenticated || !auth.user) {
    return c.json(
      {
        error: "Unauthorized",
        message: auth.reason || "Authentication required to upload media."
      },
      401
    );
  }
  const contentType = c.req.header("content-type") || "";
  let fileBuffer = null;
  let mimeType = "";
  let visibility = (c.req.query("visibility") || c.req.header("x-media-visibility") || "public").toLowerCase();
  if (visibility !== "public" && visibility !== "private") {
    visibility = "public";
  }
  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await c.req.parseBody();
      const file = formData["file"];
      if (!file || !(file instanceof File)) {
        return c.json(
          {
            error: "Bad Request",
            message: 'No valid file found in multipart form-data (field "file").'
          },
          400
        );
      }
      fileBuffer = await file.arrayBuffer();
      mimeType = file.type || "application/octet-stream";
      if (formData["visibility"] && typeof formData["visibility"] === "string") {
        const formVis = formData["visibility"].toLowerCase();
        if (formVis === "public" || formVis === "private") {
          visibility = formVis;
        }
      }
    } catch {
      return c.json(
        { error: "Bad Request", message: "Failed to parse multipart form-data." },
        400
      );
    }
  } else {
    mimeType = contentType.split(";")[0].trim().toLowerCase();
    try {
      fileBuffer = await c.req.raw.arrayBuffer();
    } catch {
      return c.json(
        { error: "Bad Request", message: "Failed to read request body." },
        400
      );
    }
  }
  if (!fileBuffer || fileBuffer.byteLength === 0) {
    return c.json({ error: "Bad Request", message: "Empty file payload." }, 400);
  }
  if (fileBuffer.byteLength > MAX_FILE_SIZE) {
    return c.json(
      {
        error: "Payload Too Large",
        message: `File size exceeds maximum allowed limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
      },
      413
    );
  }
  const ext = ALLOWED_MIME_TYPES[mimeType];
  if (!ext) {
    return c.json(
      {
        error: "Unsupported Media Type",
        message: "Only JPEG, PNG, WebP, and GIF images are permitted."
      },
      415
    );
  }
  const magicValidation = validateMagicBytes(fileBuffer, mimeType);
  if (!magicValidation.valid) {
    return c.json(
      {
        error: "Bad Request",
        message: magicValidation.reason || "File magic bytes do not match declared MIME type."
      },
      400
    );
  }
  const uuid = crypto.randomUUID().replace(/-/g, "");
  const fileKey = visibility === "private" ? `priv_${auth.user.id}_${uuid}.${ext}` : `pub_${uuid}.${ext}`;
  try {
    await c.env.MEDIA_BUCKET.put(fileKey, fileBuffer, {
      httpMetadata: {
        contentType: mimeType
      },
      customMetadata: {
        visibility,
        ownerId: auth.user.id,
        uploaderRole: auth.user.role,
        uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
    return c.json(
      {
        success: true,
        key: fileKey,
        url: `/api/media/${fileKey}`,
        visibility,
        ownerId: auth.user.id,
        sizeBytes: fileBuffer.byteLength,
        contentType: mimeType
      },
      201
    );
  } catch {
    return c.json(
      {
        error: "Internal Server Error",
        message: "Failed to store file in R2 storage."
      },
      500
    );
  }
});
mediaRouter.post("/internal/media/upload", async (c) => {
  if (!c.env.MEDIA_BUCKET) {
    return c.json(
      {
        error: "Service Unavailable",
        message: "Cloudflare R2 Media Bucket is not configured or unavailable."
      },
      503
    );
  }
  const internalAuth = await authenticateInternalMediaService(c);
  if (!internalAuth.authorized) {
    return c.json(
      {
        error: "Unauthorized",
        message: internalAuth.reason || "Invalid internal media credential."
      },
      401
    );
  }
  const contentType = c.req.header("content-type") || "";
  const mimeType = contentType.split(";")[0].trim().toLowerCase();
  let fileBuffer = null;
  try {
    fileBuffer = await c.req.raw.arrayBuffer();
  } catch {
    return c.json({ error: "Bad Request", message: "Failed to read request body." }, 400);
  }
  if (!fileBuffer || fileBuffer.byteLength === 0) {
    return c.json({ error: "Bad Request", message: "Empty file payload." }, 400);
  }
  if (fileBuffer.byteLength > MAX_FILE_SIZE) {
    return c.json(
      {
        error: "Payload Too Large",
        message: `File size exceeds maximum allowed limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
      },
      413
    );
  }
  const ext = ALLOWED_MIME_TYPES[mimeType];
  if (!ext) {
    return c.json(
      {
        error: "Unsupported Media Type",
        message: "Only JPEG, PNG, WebP, and GIF images are permitted."
      },
      415
    );
  }
  const magicValidation = validateMagicBytes(fileBuffer, mimeType);
  if (!magicValidation.valid) {
    return c.json(
      {
        error: "Bad Request",
        message: magicValidation.reason || "File magic bytes do not match declared MIME type."
      },
      400
    );
  }
  const uuid = crypto.randomUUID().replace(/-/g, "");
  const fileKey = `internal_${uuid}.${ext}`;
  try {
    await c.env.MEDIA_BUCKET.put(fileKey, fileBuffer, {
      httpMetadata: { contentType: mimeType },
      customMetadata: {
        visibility: "internal",
        serviceUpload: "true",
        uploadedBy: "internal_media_service",
        uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
    return c.json(
      {
        success: true,
        key: fileKey,
        url: `/api/media/${fileKey}`,
        visibility: "internal",
        sizeBytes: fileBuffer.byteLength,
        contentType: mimeType
      },
      201
    );
  } catch {
    return c.json(
      { error: "Internal Server Error", message: "Failed to store file in R2 storage." },
      500
    );
  }
});
mediaRouter.get("/media/:key", async (c) => {
  if (!c.env.MEDIA_BUCKET) {
    return c.json(
      {
        error: "Service Unavailable",
        message: "Cloudflare R2 Media Bucket is not configured or unavailable."
      },
      503
    );
  }
  const key = c.req.param("key");
  if (!/^[a-zA-Z0-9_\-\.]+$/.test(key) || key.includes("..") || key.includes("/") || key.includes("\\")) {
    return c.json({ error: "Bad Request", message: "Invalid media key format." }, 400);
  }
  try {
    const object = await c.env.MEDIA_BUCKET.get(key);
    if (!object) {
      return c.json({ error: "Not Found", message: "Media object not found." }, 404);
    }
    const isPrivate = key.startsWith("priv_") || object.customMetadata?.visibility === "private";
    if (isPrivate) {
      const auth = await authenticateUserJwt(c);
      if (!auth.authenticated || !auth.user) {
        return c.json(
          {
            error: "Unauthorized",
            message: auth.reason || "Authentication required to access private media object."
          },
          401
        );
      }
      const ownerId = object.customMetadata?.ownerId;
      const isOwner = ownerId && ownerId === auth.user.id || key.startsWith(`priv_${auth.user.id}_`);
      const isAdmin = auth.user.role === "admin" || auth.user.role === "super_admin";
      if (!isOwner && !isAdmin) {
        return c.json(
          {
            error: "Forbidden",
            message: "You do not have permission to access this private media object."
          },
          403
        );
      }
      let contentType2 = object.httpMetadata?.contentType || "application/octet-stream";
      if (contentType2.includes("html") || contentType2.includes("svg") || contentType2.includes("xml")) {
        contentType2 = "application/octet-stream";
      }
      const headers2 = new Headers();
      headers2.set("Content-Type", contentType2);
      headers2.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
      headers2.set("X-Content-Type-Options", "nosniff");
      headers2.set("Content-Security-Policy", "default-src 'none'; sandbox");
      return new Response(object.body, {
        status: 200,
        headers: headers2
      });
    }
    let contentType = object.httpMetadata?.contentType || "application/octet-stream";
    if (contentType.includes("html") || contentType.includes("svg") || contentType.includes("xml")) {
      contentType = "application/octet-stream";
    }
    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Content-Security-Policy", "default-src 'none'; sandbox");
    if (object.httpEtag) {
      headers.set("ETag", object.httpEtag);
    }
    return new Response(object.body, {
      status: 200,
      headers
    });
  } catch {
    return c.json(
      { error: "Internal Server Error", message: "Failed to retrieve media object." },
      500
    );
  }
});

// src/worker/app.ts
function createApp() {
  const app2 = new Hono3();
  app2.use("*", secureHeaders());
  app2.use(
    "*",
    cors({
      origin: (origin) => {
        if (!origin) return "*";
        const allowed = [
          "http://localhost:3000",
          "http://localhost:5173",
          "http://127.0.0.1:3000",
          "http://127.0.0.1:5173",
          "https://stroom.in",
          "https://www.stroom.in",
          "https://stroom.pages.dev"
        ];
        return allowed.includes(origin) ? origin : null;
      },
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "X-STROOM-Bridge-Secret", "X-STROOM-Timestamp", "X-STROOM-Nonce", "X-STROOM-Signature", "X-STROOM-Action"],
      credentials: true
    })
  );
  app2.route("/api", healthRouter);
  app2.route("/api", internalBridgeRouter);
  app2.route("/api", authProxyRouter);
  app2.route("/api", mediaRouter);
  app2.notFound((c) => {
    return c.json({ error: "Endpoint not found" }, 404);
  });
  app2.onError((err, c) => {
    return c.json(
      {
        error: "Internal Server Error",
        message: c.env?.NODE_ENV === "development" ? err.message : void 0
      },
      500
    );
  });
  return app2;
}

// src/worker/index.ts
var app = createApp();
var index_default = app;
export {
  index_default as default
};
