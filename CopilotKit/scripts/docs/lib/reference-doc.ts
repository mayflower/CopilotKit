import { SourceFile } from "./source";
import { Comments } from "./comments";

// @ts-ignore
import fs from "fs";

export interface ReferenceDocConfiguration {
  sourcePath: string;
  destinationPath: string;
  className?: string;
  component?: string;
  hook?: string;
  description?: string;
}
// docs/pages/reference/classes/CopilotRuntime/service-adapters/GoogleGenerativeAIAdapter.mdx
export class ReferenceDoc {
  constructor(private readonly referenceDoc: ReferenceDocConfiguration) {}

  async generate() {
    const generatedDocumentation = await this.generatedDocs();
    // console.log(generatedDocumentation);
    if (generatedDocumentation) {
      const dest = "../" + this.referenceDoc.destinationPath;
      fs.writeFileSync(dest, generatedDocumentation);
      console.log(`Successfully autogenerated ${dest} from ${this.referenceDoc.sourcePath}`);
    }
  }

  async generatedDocs(): Promise<string | null> {
    const source = new SourceFile(this.referenceDoc.sourcePath);
    await source.parse();

    const comment = Comments.getFirstCommentBlock(source.sourceFile);

    if (!comment) {
      console.warn(`No comment found for ${this.referenceDoc.sourcePath}`);
      console.warn("Skipping...");
      return null;
    }

    const arg0Interface = await source.getArg0Interface(
      this.referenceDoc.className || this.referenceDoc.component || this.referenceDoc.hook || "",
    );

    let result: string = "";

    // handle imports
    const slashes = this.referenceDoc.destinationPath.split("/").length;
    let importPathPrefix = "";
    for (let i = 0; i < slashes - 2; i++) {
      importPathPrefix += "../";
    }

    result += `---\n`;
    result += `title: "${this.referenceDoc.className || this.referenceDoc.component || this.referenceDoc.hook}"\n`;
    if (this.referenceDoc.description) {
      result += `description: "${this.referenceDoc.description}"\n`;
    }
    result += `---\n\n`;

    result += `{\n`;
    result += ` /*\n`;
    result += `  * ATTENTION! DO NOT MODIFY THIS FILE!\n`;
    result += `  * This page is auto-generated. If you want to make any changes to this page, changes must be made at:\n`;
    result += `  * CopilotKit/${this.referenceDoc.sourcePath}\n`;
    result += `  */\n`;
    result += `}\n`;

    result += `${comment}\n\n`;

    if (this.referenceDoc.hook) {
      result += `## Parameters\n\n`;
    } else if (this.referenceDoc.component) {
      result += `## Properties\n\n`;
    } else if (this.referenceDoc.className) {
      result += `## Constructor Parameters\n\n`;
    }

    if (arg0Interface) {
      for (const property of arg0Interface.properties) {
        if (property.comment.includes("@deprecated")) {
          continue;
        }
        const type = property.type.replace(/"/g, "'");

        result += `<PropertyReference name="${property.name}" type="${type}" ${property.required ? "required" : ""} ${property.defaultValue ? `default="${property.defaultValue}"` : ""}> \n`;
        result += `${property.comment}\n`;
        result += `</PropertyReference>\n\n`;
      }
    } else if (this.referenceDoc.className) {
      const constr = source.getConstructorDefinition(this.referenceDoc.className);
      if (constr) {
        result += `## ${constr.signature}\n\n`;
        result += `${constr.comment}\n\n`;
        for (const param of constr.parameters) {
          const type = param.type.replace(/"/g, "'");

          result += `<PropertyReference name="${param.name}" type="${type}" ${param.required ? "required" : ""}>\n`;
          result += `${param.comment}\n`;
          result += `</PropertyReference>\n\n`;
        }
      }
    }

    if (this.referenceDoc.className) {
      const methodDefinitions = await source.getPublicMethodDefinitions(
        this.referenceDoc.className,
      );

      for (const method of methodDefinitions) {
        if (
          method.signature === "process(request: CopilotRuntimeChatCompletionRequest)" ||
          method.signature === "process(request: CopilotRuntimeRequest)"
        ) {
          // skip the process method
          continue;
        }

        const methodName = method.signature.split("(")[0];
        const methodArgs = method.signature.split("(")[1].split(")")[0];
        result += `<PropertyReference name="${methodName}" type="${methodArgs}">\n`;
        result += `${method.comment}\n\n`;
        for (const param of method.parameters) {
          const type = param.type.replace(/"/g, "'");

          result += `  <PropertyReference name="${param.name}" type="${type}" ${param.required ? "required" : ""}>\n`;
          result += `  ${param.comment}\n`;
          result += `  </PropertyReference>\n\n`;
        }
        result += `</PropertyReference>\n\n`;
      }
    }

    return result;
  }
}
