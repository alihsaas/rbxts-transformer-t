import ts, { factory } from "typescript";
import path from "path";
import fs from "fs";
import * as utility from "./utility";
import * as transformerUtil from "./transformer";
import { buildType } from "./transformer";

let didReplaceImport = false;

export default function transformer(program: ts.Program): ts.TransformerFactory<ts.SourceFile> {
	return (context: ts.TransformationContext) => (file: ts.SourceFile) => {

		const replaceIndexNode = (file: ts.SourceFile) => {

			const replacer = utility.getNodeReplacer(
				transformerUtil.is_t_ImportDeclaration(program), factory.createEmptyStatement()
			)

			return ts.visitEachChild(file, node => {
				const [replacement, didReplace] = replacer(node, program);
				didReplaceImport = didReplace
				return replacement
			}, context)
		}

		return visitNodeAndChildren(replaceIndexNode(file), program, context)
	}
}

function visitNodeAndChildren(node: ts.SourceFile, program: ts.Program, context: ts.TransformationContext): ts.SourceFile;
function visitNodeAndChildren(node: ts.Node, program: ts.Program, context: ts.TransformationContext): ts.Node | undefined;
function visitNodeAndChildren(node: ts.Node, program: ts.Program, context: ts.TransformationContext): ts.Node | undefined {
	return ts.visitEachChild(visitNode(node, program), childNode => visitNodeAndChildren(childNode, program, context), context);
}

function visitNode(node: ts.SourceFile, program: ts.Program): ts.SourceFile;
function visitNode(node: ts.Node, program: ts.Program): ts.Node | undefined;
function visitNode(node: ts.Node, program: ts.Program): ts.VisitResult<ts.Node> | undefined {
	if (isModuleImportExpression(node, program))
		if (didReplaceImport)
			return node // factory.createEmptyStatement()
		else
			return [
				factory.createImportDeclaration(undefined, undefined,
					factory.createImportClause(
						false,
						undefined,
						factory.createNamedImports([
							factory.createImportSpecifier(false, undefined, factory.createIdentifier(transformerUtil.OBJECT_NAME))
						]),
					),
					factory.createStringLiteral("@rbxts/t")),
				node
			]

	if (ts.isCallExpression(node))
		return visitCallExpression(node, program);

	return node;
}

function handleTerrifyCallExpression(
	node: ts.CallExpression,
	functionName: string,
	typeChecker: ts.TypeChecker,
) {
	switch (functionName) {
		case transformerUtil.MARCO_NAME: {

			const typeArguments = node.typeArguments

			if (typeArguments === undefined || typeArguments.length === 0)
				throw new Error(`Please pass a type argument to the $terrify function`)

			const type = typeChecker.getTypeFromTypeNode(typeArguments[0]);

			return buildType(type, typeChecker);
		}
		default:
			throw `function ${functionName} cannot be handled by this version of rbxts-interface-to-t`;
	}
}

function visitCallExpression(node: ts.CallExpression, program: ts.Program) {
	const typeChecker = program.getTypeChecker();
	const signature = typeChecker.getResolvedSignature(node);
	if (!signature)
		return node;

	const { declaration } = signature;
	if (!declaration || ts.isJSDocSignature(declaration) || !isModule(declaration.getSourceFile()))
		return node;

	const functionName = declaration.name && declaration.name.getText();
	if (!functionName)
		return node;

	return handleTerrifyCallExpression(node, functionName, typeChecker);
}

const sourceText = fs.readFileSync(path.join(__dirname, "..", "index.d.ts"), "utf8");
function isModule(sourceFile: ts.SourceFile) {
	return sourceFile.text === sourceText;
}

function isModuleImportExpression(node: ts.Node, program: ts.Program) {
	if (!ts.isImportDeclaration(node))
		return false;

	if (!node.importClause)
		return false;

	const namedBindings = node.importClause.namedBindings;
	if (!node.importClause.name && !namedBindings)
		return false;

	const importSymbol = program.getTypeChecker().getSymbolAtLocation(node.moduleSpecifier);

	if (!importSymbol || !isModule(importSymbol.valueDeclaration!.getSourceFile())) // TODO
		return false;

	return true;
}
