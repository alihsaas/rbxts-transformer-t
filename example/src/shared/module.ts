import { $terrify } from '../../..';

interface ExtendedType {
	Property: "!";
}

interface ReferenceType {
	SomeProperty: Color3;
}

enum CustomEnum {
    Foo,
    Baz,
}

interface Type extends ExtendedType {
	StringType: string;
	NumberType: number;
	BooleanType: boolean;
	AnyType: any;
	ThreadType: thread;
	FalsyType: undefined | void | null | unknown;
	FunctionType: () => void;

	OptionalType?: number;
	AnotherOptionalType?: BrickColor;

	ArrayType: number[];
    TupleType: [number, string, Enum.Material];

	RobloxType: Enum;
	AnotherRobloxType: Instance;

	LiteralType: "string";
	AnotherLiteralType: true;

	UnionType: 1 | 2;
	MixedUnionType: 1 | 2 | true | Enum;

	ReferenceType: ReferenceType;

	enum: Enum.Material;
	map: Map<Instance, string>;
	instanceIsA: Folder;

    CustomEnum: CustomEnum;
}

const terrifiedType = $terrify<Type>();

export function makeHello(name: string) {
	return `Hello from ${name}!`;
}
