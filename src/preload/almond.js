/**
 * Hotfix code edited from a compiled form of almond.js.
 *
 * Original license may be:
 * almond 0.2.5 Copyright (c) 2011-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
/* eslint-disable */
var requirejs, require, define;
const e = undefined;
var n,
  r,
  i,
  t,
  o = {},
  u = {},
  f = {},
  c = {},
  l = Object.prototype.hasOwnProperty,
  s = [].slice;
function p(e, n) {
  return l.call(e, n);
}
function a(e, n) {
  var r,
    i,
    t,
    o,
    u,
    c,
    l,
    s,
    p,
    a,
    d = n && n.split("/"),
    g = f.map,
    q = (g && g["*"]) || {};
  if (e && "." === e.charAt(0))
    if (n) {
      for (
        e = (d = d.slice(0, d.length - 1)).concat(e.split("/")), s = 0;
        s < e.length;
        s += 1
      )
        if ("." === (a = e[s])) e.splice(s, 1), (s -= 1);
        else if (".." === a) {
          if (1 === s && (".." === e[2] || ".." === e[0])) break;
          s > 0 && (e.splice(s - 1, 2), (s -= 2));
        }
      e = e.join("/");
    } else 0 === e.indexOf("./") && (e = e.substring(2));
  if ((d || q) && g) {
    for (s = (r = e.split("/")).length; s > 0; s -= 1) {
      if (((i = r.slice(0, s).join("/")), d))
        for (p = d.length; p > 0; p -= 1)
          if ((t = g[d.slice(0, p).join("/")]) && (t = t[i])) {
            (o = t), (u = s);
            break;
          }
      if (o) break;
      !c && q && q[i] && ((c = q[i]), (l = s));
    }
    !o && c && ((o = c), (u = l)), o && (r.splice(0, u, o), (e = r.join("/")));
  }
  return e;
}
function d(n, i) {
  return function () {
    return r.apply(e, s.call(arguments, 0).concat([n, i]));
  };
}
function g(e) {
  return function (n) {
    o[e] = n;
  };
}
function q(r) {
  if (p(u, r)) {
    var i = u[r];
    delete u[r], (c[r] = !0), n.apply(e, i);
  }
  if (!p(o, r) && !p(c, r)) throw new Error("No " + r);
  return o[r];
}
function O(e) {
  var n,
    r = e ? e.indexOf("!") : -1;
  return (
    r > -1 && ((n = e.substring(0, r)), (e = e.substring(r + 1, e.length))),
    [n, e]
  );
}
function h(e) {
  return function () {
    return (f && f.config && f.config[e]) || {};
  };
}
i = function (e, n) {
  var r,
    i = O(e),
    t = i[0];
  return (
    (e = i[1]),
    t && (r = q((t = a(t, n)))),
    t
      ? (e =
          r && r.normalize
            ? r.normalize(
                e,
                (function (e) {
                  return function (n) {
                    return a(n, e);
                  };
                })(n)
              )
            : a(e, n))
      : ((t = (i = O((e = a(e, n))))[0]), (e = i[1]), t && (r = q(t))),
    {
      f: t ? t + "!" + e : e,
      n: e,
      pr: t,
      p: r,
    }
  );
};
t = {
  require: function (e) {
    return d(e);
  },
  exports: function (e) {
    var n = o[e];
    return void 0 !== n ? n : (o[e] = {});
  },
  module: function (e) {
    return {
      id: e,
      uri: "",
      exports: o[e],
      config: h(e),
    };
  },
};
n = function (n, r, f, l) {
  var s,
    a,
    O,
    h,
    E,
    j,
    m = [];
  if (((l = l || n), "function" == typeof f)) {
    for (
      r = !r.length && f.length ? ["require", "exports", "module"] : r, E = 0;
      E < r.length;
      E += 1
    )
      if ("require" === (a = (h = i(r[E], l)).f)) m[E] = t.require(n);
      else if ("exports" === a) (m[E] = t.exports(n)), (j = !0);
      else if ("module" === a) s = m[E] = t.module(n);
      else if (p(o, a) || p(u, a) || p(c, a)) m[E] = q(a);
      else {
        if (!h.p) throw new Error(n + " missing " + a);
        h.p.load(h.n, d(l, !0), g(a), {}), (m[E] = o[a]);
      }
    (O = f.apply(o[n], m)),
      n &&
        (s && s.exports !== e && s.exports !== o[n]
          ? (o[n] = s.exports)
          : (O === e && j) || (o[n] = O));
  } else n && (o[n] = f);
};
requirejs =
  require =
  r =
    function (o, u, c, l, s) {
      return "string" == typeof o
        ? t[o]
          ? t[o](u)
          : q(i(o, u).f)
        : (o.splice ||
            ((f = o), u.splice ? ((o = u), (u = c), (c = null)) : (o = e)),
          (u = u || function () {}),
          "function" == typeof c && ((c = l), (l = s)),
          l
            ? n(e, o, u, c)
            : setTimeout(function () {
                n(e, o, u, c);
              }, 4),
          r);
    };
r.config = function (e) {
  return (f = e).deps && r(f.deps, f.callback), r;
};
define = function (e, n, r) {
  n.splice || ((r = n), (n = [])), p(o, e) || p(u, e) || (u[e] = [e, n, r]);
};
define.amd = {
  jQuery: !0,
};
export { define, require, requirejs };
