# Tickers

The basic syntax of a ticker is just `ticker` followed by an expression.

```js
ticker a -> a + 1
a = 0
```

Tickers can use actions defined elsewhere

```js
ticker mainAction
mainAction = a -> a + 1, b -> b * 2
a = 0
b = 1
```

## Style Mapping

```js
ticker a -> a + 1 @{
  minStep: 2000,
  playing: true
}
```

The `minStep` is the minimum update interval in milliseconds.
