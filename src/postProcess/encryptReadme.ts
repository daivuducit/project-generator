import * as fs from "fs";
import * as path from "path";
import { encryptReadme } from "../crypto/normalCrypto";

function findReadme(root: string): string | null {
  const candidates = [
    path.join(root, "README.md"),
    path.join(root, "src", "README.md"),
  ];



  for (const p of candidates) {
    if (fs.existsSync(p)){ return p;}
  }
  return null;
}

export async function encryptReadmeIfExists(projectPath: string) {


  if (!fs.existsSync(projectPath)) {
    console.error("[ENC] projectPath DOES NOT EXIST");
    return;
  }

  const readmePath = findReadme(projectPath);

  if (!readmePath) {
    console.error("[ENC] README.md NOT FOUND ANYWHERE");
    return;
  }

  const plain = fs.readFileSync(readmePath, "utf8");


  const enc = encryptReadme(plain);


  const encPath = readmePath.replace(/README\.md$/, "README.enc");
  fs.writeFileSync(encPath, enc);


  fs.unlinkSync(readmePath);


}
