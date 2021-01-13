import ts from "typescript";
import path from "path";

/**
 * Concatenates two arrays and removes duplicates
 */

export function mergeArrays<T>(array1: T[], array2: T[]): T[] {

	return [...new Set([...array1, ...array2])]
}

/**
 * Separates an array into two arrays:
 * the first array contains elements matched
 * by predicate as true, the second as false.
 */
export function separateArray<T>(array: T[], predicate: (element: T) => boolean): [T[], T[]] {

	const nextIteration = (array: T[], onTrue: T[], onFalse: T[]): [T[], T[]] => {

		if (array.length === 0)
			return [onTrue, onFalse]

		const [head, ...tail] = array

		if (predicate(head))
			return nextIteration(tail, [...onTrue, head], onFalse)

		return nextIteration(tail, onTrue, [...onFalse, head])
	}

	return nextIteration(array, [], [])
}

/**
 * Checks if type is an EnumItem
 */

export function isEnum(type: ts.Type): boolean {
	return (<any>type.aliasSymbol)?.parent?.escapedName === "Enum";
}

/**
 * Checks if ts.Type is a function
 */

export function isFunctionType(type: ts.Type): boolean {

	return type.getCallSignatures().length !== 0
}

/**
 * Checks if ts.Type is of ts.TupleType
 */

export function isTupleType(type: ts.Type, typeChecker: ts.TypeChecker): type is ts.TupleType {
	return (<any>typeChecker).isTupleType(type)
}

/**
 * Checks if ts.Type is of Array type
 */

export function isArrayType(type: ts.Type, typeChecker: ts.TypeChecker): type is ts.GenericType {

	return (<any>typeChecker).isArrayType(type)
}

/**
 * Checks if ts.Type is of Map type
 */

export function isMapType(type: ts.Type): type is ts.GenericType {
	return type.symbol?.getName() === "Map"
}

/**
 * Checks if ts.Type is of Map type
 */

export function isBrickColorType(type: ts.Type): type is ts.GenericType {
	return type.symbol?.getName() === "BrickColor"
}

/**
 * Converts array of ts.Types to array of ts.Expressions
 */

/**
 * Checks if ts.Type being is of ts.ObjectType
 */

export function isObjectType(type: ts.Type): type is ts.ObjectType {

	return type.symbol?.getName() === '__type'
}

/**
 * Checks if property declaration matched is optional
 */

export function isOptionalPropertyDeclaration(prop: ts.Symbol): boolean {

	const property = prop.valueDeclaration as ts.PropertyDeclaration

	return property.questionToken !== undefined
}


/**
 * Checks if type is a literal
 */

export function isLiteral(typeChecker: ts.TypeChecker): (type: ts.Type) => boolean {
	return (type: ts.Type): boolean => type.isLiteral() || ["true", "false"].includes(typeChecker.typeToString(type))
}

/**
 * Extracts property type and name from ts.Symbol
 */

export function extractProperty(prop: ts.Symbol, typeChecker: ts.TypeChecker): { name: string, type: ts.Type } {

	const declaration = prop.valueDeclaration

	const type = (<any>prop).type === undefined
		? typeChecker.getTypeFromTypeNode((<any>declaration).type)
		: (<any>prop).type.target ?? (<any>prop).type

	const name = String(prop.escapedName)

	return { name, type }
}

/**
 * Builds name for property.
 * If it is simple, use just string.
 * For complex names wrap it into ts.StringLiteral
 */

export function buildPropertyName(name: string): string | ts.StringLiteral {

	if (name.match(/^[a-zA-Z_]+[\w_]+$/) !== null)
		return name

	return ts.factory.createStringLiteral(name)
}

/**
 * Represents function that maps single node
 */

type MappingFunction = {
	(node: ts.SourceFile, program: ts.Program): ts.SourceFile
	(node: ts.Node, program: ts.Program): ts.Node | undefined
}

/**
 * Predicate accepts ts.Node or it's subtypes
 */

type NodePredicate<T extends ts.Node = ts.Node> = (node: T) => boolean

/**
 * Returns mapping function that replaces
 * single node satisfies the passed predicate
 * with a replacement node passed
 */

export function getSingleNodeReplacer(predicate: NodePredicate, replacement: ts.Node): MappingFunction {

	let replaced = false

	return (node: any) => {

		if (replaced || !predicate(node))
			return node

		replaced = true

		return replacement
	}
}