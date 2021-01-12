import ts, { factory } from "typescript";
import { getInstalledPathSync } from 'get-installed-path';
import path from "path";
import fs from "fs";
import * as utility from "./utility";

export const OBJECT_NAME = "t";
export const MARCO_NAME = "$terrify";
export const instanceIsA = "instanceIsA";

/**
 * builds real path by relative path
 */

function getRealPath(filePath: string): string {

	return path.join(__dirname, "..", filePath)
}

const indexTsPath = getRealPath('index.d.ts')

function get_t_Path(): string {
	try {
		return getInstalledPathSync("@rbxts/t", { local: true })
	} catch {
		throw "[rbxts-transformer-t ERROR]: @rbxts/t must be installed for rbxts-transformer-t to work."
	}
}

const ROBLOX_TYPES = [
	"Axes",
	"BrickColor",
	"CFrame",
	"Color3",
	"ColorSequence",
	"ColorSequenceKeypoint",
	"DockWidgetPluginGuiInfo",
	"Faces",
	"Instance",
	"NumberRange",
	"NumberSequence",
	"NumberSequenceKeypoint",
	"PathWaypoint",
	"PhysicalProperties",
	"Random",
	"Ray",
	"Rect",
	"Region3",
	"Region3int16",
	"TweenInfo",
	"UDim",
	"UDim2",
	"Vector2",
	"Vector3",
	"Vector3int16",
	"RBXScriptSignal",
	"RBXScriptConnection",

	"Enum",
	"EnumItem",
]

function createPropertyAccess(propertyName: string): ts.PropertyAccessExpression {
	return factory.createPropertyAccessExpression(factory.createIdentifier(OBJECT_NAME), factory.createIdentifier(propertyName))
}

function createMethodCall(methodName: string, params: ts.Expression[]): ts.CallExpression {
	return factory.createCallExpression(createPropertyAccess(methodName), undefined, params)
}

function createLiteral(literal: ts.Expression): ts.Expression {
	return createMethodCall("literal", [literal])
}

function createLiteralExpression(type: ts.Type, typeChecker: ts.TypeChecker) {
	const stringType = typeChecker.typeToString(type)

	if (stringType === "true" || stringType === "false") {

		return stringType === "true" ? factory.createTrue() : factory.createFalse()
	}

	if (type.isStringLiteral())
		return factory.createStringLiteral(type.value)

	if (type.isNumberLiteral())
		return factory.createNumericLiteral(type.value.toString())
}

function convertTypesArray(types: readonly ts.Type[], typeChecker: ts.TypeChecker): ts.Expression[] {

	const transformNextType = (types: readonly ts.Type[], result: ts.Expression[]): ts.Expression[] => {

		if (types.length === 0)
			return result

		const [head, ...tail] = types

		const res = buildType(head, typeChecker)

		return transformNextType(tail, [...result, res])
	}

	return transformNextType(types, [])
}


/**
 * Converts ts.UnionType to a ts.Expression
 */

function convertUnionType(type: ts.UnionType, typeChecker: ts.TypeChecker): ts.Expression {

	const nodes = type.aliasSymbol?.declarations

	const types: ts.Type[] = nodes !== undefined && nodes.length !== 0
		? (<any>nodes[0]).type.types.map(typeChecker.getTypeFromTypeNode)
		: type.types

	const [literalTypes, notLiteralTypes] = utility.separateArray(types, utility.isLiteral(typeChecker));

	const literalExpression = literalTypes.length === 0 ?
		undefined :
		factory.createCallExpression(createPropertyAccess("literal"), undefined,
			literalTypes.map((type) => createLiteralExpression(type, typeChecker) as ts.Expression))

	const result = convertTypesArray(notLiteralTypes, typeChecker)

	if (result.length === 0 && literalExpression)
		return literalExpression

	if (literalExpression)
		result.push(literalExpression)

	return createMethodCall("union", result)
}

/**
 * Converts ts.TupleType to a ts.Expression
 */

function convertTupleType(type: ts.TupleType, typeChecker: ts.TypeChecker): ts.Expression {

	const result = convertTypesArray((<any>type).resolvedTypeArguments, typeChecker)

	return createMethodCall("tuple", result)
}

/**
 * Converts Array type to a ts.Expression
 */

function convertArrayType(type: ts.GenericType, typeChecker: ts.TypeChecker): ts.Expression {

	const args = type.typeArguments

	if (args === undefined || args.length === 0)
		throw new Error("Array must have type arguments")

	const result = buildType(args[0], typeChecker)

	return createMethodCall("array", [result])
}

/**
 * Converts Map type to a ts.Expression
 */

function convertMapType(type: ts.GenericType, typeChecker: ts.TypeChecker): ts.Expression {

	const args = type.typeArguments

	if (args === undefined)
		throw new Error("Map must have type arguments")

	const result = convertTypesArray(args, typeChecker)

	return createMethodCall("map", result)
}

/**
 * Converts Array of object properties to t.interface Expression. If there are
 * optional properties, they will be built as separate objects
 * and mixed to main object using t.intersection function
 */

function convertObjectType(props: ts.Symbol[], typeChecker: ts.TypeChecker): ts.Expression {

	if (props.length === 0)
		return createMethodCall("interface", [factory.createObjectLiteralExpression([])])

	const preparedProps = props.map(prop => {

		const origin = (prop as any).syntheticOrigin

		return origin !== undefined ? origin : prop
	})

	// separate properties by weither
	// property is optional or not
	// and get 2 property lists

	const [optionalProps, nonOptionalProps] = utility.separateArray(preparedProps, utility.isOptionalPropertyDeclaration)

	// Builds t.interface entity by property list
	const handlePropList = (props: ts.Symbol[], isOptional?: boolean): ts.Expression => {

		const handledProps = props.map(prop => utility.extractProperty(prop, typeChecker))

		const types = handledProps.map(prop => prop.type)

		const result = convertTypesArray(types, typeChecker)

		const properties = result.map(
			(p, i) => factory.createPropertyAssignment(utility.buildPropertyName(handledProps[i].name), isOptional ? createMethodCall("optional", [p]) : p)
		)

		return createMethodCall("interface", [factory.createObjectLiteralExpression(properties)])
	}

	// Build 2 or 1 objects for each optional props object  and add them to the result array
	const result: ts.Expression[] = []

	if (optionalProps.length !== 0)
		result.push(handlePropList(optionalProps, true))

	if (nonOptionalProps.length !== 0)
		result.push(handlePropList(nonOptionalProps))

	return result.length === 1
		? result[0]
		: createMethodCall("intersection", result)
}

/**
 * Converts interface type to to ts.Expression
 */

function convertInterfaceType(type: ts.InterfaceType, typeChecker: ts.TypeChecker): ts.Expression {

	const props = (type as any).declaredProperties ?? []

	const object = convertObjectType(props, typeChecker)

	const parents = type.symbol.declarations
		.map((d: any) => d.heritageClauses)
		.filter(Boolean)
		.reduce(utility.mergeArrays, [])
		.map((clause: any) => clause.types)
		.reduce(utility.mergeArrays, [])
		.map(typeChecker.getTypeFromTypeNode)

	if (parents.length === 0)
		return object

	const parentsTransformed = convertTypesArray(parents, typeChecker)

	const nodesArray = [object, ...parentsTransformed]

	return createMethodCall("intersection", nodesArray)
}

let tTypeDefinitions = fs.readFileSync(path.join(get_t_Path(), "lib", "t.d.ts"), "utf8")

export function is_t_ImportDeclaration(program: ts.Program) {
	return (node: ts.Node) => {
		if (!ts.isImportDeclaration(node)) {
			return false;
		}

		if (!node.importClause) {
			return false;
		}

		const namedBindings = node.importClause.namedBindings;
		if (!node.importClause.name && !namedBindings) {
			return false;
		}

		const importSymbol = program.getTypeChecker().getSymbolAtLocation(node.moduleSpecifier);

		if (!importSymbol || importSymbol.valueDeclaration.getSourceFile().text !== tTypeDefinitions) {
			return false;
		}

		return true;
	}
}

/**
 * Finds all FromIoTs usages in the file
 * and returns a record of type ids and
 * expressions that types to be replaced
 */

export const data: { usageOfInstanceIsA: Record<number, ts.Type> } = {
	usageOfInstanceIsA: {}
}

export function findInstanceIsAUsages(file: ts.SourceFile, typeChecker: ts.TypeChecker): Record<number, ts.Type> {

	const handleNode = (node: ts.Identifier): Record<number, ts.Type> => {

		if (ts.isImportSpecifier(node.parent))
			return {}

		const symbol = utility.getAliasedSymbolOfNode(node, typeChecker)

		if (symbol === undefined || !utility.isSymbolOf(symbol, instanceIsA, indexTsPath))
			return {}

		const parent = ts.isPropertyAccessOrQualifiedName(node.parent) ? node.parent.parent : node.parent

		const args = (<any>parent).typeArguments

		const type = typeChecker.getTypeFromTypeNode(<any>parent)

		return { [utility.getTypeId(type)]: args[0] }
	}

	const visitor = (node: ts.Node): Record<number, ts.Type> => {

		const nodeResult = ts.isIdentifier(node) ? handleNode(node) : {}

		const childrenResult = node.getChildren().map(visitor)

		return [nodeResult, ...childrenResult].reduce(utility.mergeObjects)
	}

	return visitor(file)
}

export function buildType(type: ts.Type, typeChecker: ts.TypeChecker): ts.Expression {
	const stringType = typeChecker.typeToString(type)

	// Checking for error cases
	if (stringType === "never")
		throw new Error("Never type transformation is not supported")

	if (type.isClass())
		throw new Error("Transformation of classes is not supported")

	const typeId = utility.getTypeId(type)

	const fromIoTs = data.usageOfInstanceIsA[typeId]

	if (fromIoTs !== undefined)
		return createMethodCall("instanceIsA", [factory.createStringLiteral(stringType)])

	// Basic types transformation
	if (["null", "undefined", "void", "unknown"].includes(stringType))
		return createPropertyAccess("none")

	if (ROBLOX_TYPES.includes(stringType))
		return createPropertyAccess(stringType)

	if (utility.isBrickColorType(type))
		return createPropertyAccess("BrickColor")

	if (utility.isEnum(type))
		return createMethodCall("enum", [factory.createPropertyAccessExpression(factory.createIdentifier("Enum"), stringType)])

	if (stringType === "true" || stringType === "false") {

		const literal = stringType === "true" ? factory.createTrue() : factory.createFalse()

		return createLiteral(literal)
	}

	if (type.isStringLiteral())
		return createLiteral(factory.createStringLiteral(type.value))

	if (type.isNumberLiteral())
		return createLiteral(factory.createNumericLiteral(type.value.toString()))

	if (["string", "number", "boolean", "any", "thread"].includes(stringType))
		return createPropertyAccess(stringType)

	if (utility.isFunctionType(type))
		return createPropertyAccess("callback")

	// Complex types transformation
	try {

		if (utility.isMapType(type))
			return convertMapType(type, typeChecker)

		if (type.isUnion())
			return convertUnionType(type, typeChecker)

		else if (utility.isTupleType(type, typeChecker))
			return convertTupleType(type, typeChecker)

		else if (utility.isArrayType(type, typeChecker))
			return convertArrayType(type, typeChecker)

		else if (utility.isObjectType(type))
			return convertObjectType(type.getProperties(), typeChecker)

		if (type.isClassOrInterface())
			return convertInterfaceType(type, typeChecker)

	} catch (err) {
		throw `[t-ts-transformer ERROR]: Failed to build type ${stringType} with error ${err}`
	}

	throw `Cannot build type ${stringType}`
}
