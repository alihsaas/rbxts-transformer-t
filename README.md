# t-ts-transformer
TypeScript transformer which converts TypeScript types to t entities

# Installation

To install this package run the following command:

`npm i t-ts-transformer`

# Usage

To use this transformer you have to add `t-ts-transformer` to your `tsconfig.json` file in `compilerOptions` config

```json
"plugins": [
	{
		"transform": "t-ts-transformer",
	}
]
```

## Before

```ts
import { $terrify } from "t-ts-transformer";

interface Data {
	Color: Color3;
	Name: string;
	Material: Enum.Material;
}

const tType = $terrify<Data>();
```

## After

```lua
local t = TS.import(script, TS.getModule(script, "t").lib.ts).t

local tType = t.interface({
	Color = t.Color3,
	Name = t.string,
	Material = t.enum(Enum.Material),
})
```
 
# About this transformer

## What it can do

1) Transform almost all TypeScript types into t models: 
- null, undefined, void, unknown
- string, boolean and number literals
- string, boolean, number, any and thread types
- arrays, tuples, maps, objects and functions
- type unions and intersections
- interfaces types
- roblox types such as Enum Axes
- Enums to enum ex. Enum.Material => t.enum(Enum.Material)


2) Compute expressions passed into it.

For example, this expression

```TypeScript
$terrify<Omit<{ foo: 'bar', bar: number } & { data: string }, 'bar'>>()
```

will be converted into 

```lua
local t = TS.import(script, TS.getModule(script, "t").lib.ts).t

t.interface({
	foo = t.literal("bar"),
	data = t.string,
})
```

## What it can't do

1) Transform classes.

2) Work with dynamic type parameters, i.e. `$terrify<T>()` in the following code will error:
```typescript
import { $terrify } from 't-ts-transformer'

function convertEntity<T>(entity: T) {
  return $terrify<T>()
}
```