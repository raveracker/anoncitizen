import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log(
    "Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH"
  );

  // Step 1: Deploy the Groth16 verifier
  console.log("\n[1/2] Deploying Groth16Verifier...");
  const Verifier = await ethers.getContractFactory("Groth16Verifier");
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log("  Groth16Verifier deployed to:", verifierAddress);

  // Step 2: Deploy the AnonCitizen wrapper
  console.log("\n[2/2] Deploying AnonCitizen...");
  const AnonCitizen = await ethers.getContractFactory("AnonCitizen");
  const anoncitizen = await AnonCitizen.deploy(verifierAddress);
  await anoncitizen.waitForDeployment();
  const anoncitizenAddress = await anoncitizen.getAddress();
  console.log("  AnonCitizen deployed to:", anoncitizenAddress);

  // Summary
  console.log("\n=== Deployment Complete ===");
  console.log("Groth16Verifier:", verifierAddress);
  console.log("AnonCitizen:    ", anoncitizenAddress);
  console.log("\nVerify on Polygonscan:");
  console.log(
    `  npx hardhat verify --network amoy ${verifierAddress}`
  );
  console.log(
    `  npx hardhat verify --network amoy ${anoncitizenAddress} ${verifierAddress}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
