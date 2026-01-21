import { ProjectGenerator } from "../types";
import { CGenerator } from "./c";
import { JavaGenerator } from "./java";
import { PythonGenerator } from "./python";

export const allGenerators: ProjectGenerator[] = [
    new CGenerator(),
    new JavaGenerator(),
    new PythonGenerator()
];