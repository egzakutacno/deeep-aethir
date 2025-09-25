#!/usr/bin/env python3
import pexpect, json, os, subprocess

INSTALL_DIR = "/root/AethirCheckerCLI-linux"
CLI = f"{INSTALL_DIR}/AethirCheckerCLI"
JSON_PATH = "/root/wallet.json"

def run_install():
    install_sh = f"{INSTALL_DIR}/install.sh"
    if os.path.exists(install_sh):
        print("[1/3] Running install.sh ...")
        try:
            subprocess.run(["bash", install_sh], check=True)
        except subprocess.CalledProcessError:
            print("install.sh returned non-zero, continuing anyway...")
    else:
        print("install.sh not found, skipping...")

def automate_cli():
    print("[2/3] Running CLI automation ...")
    child = pexpect.spawn(CLI, encoding="utf-8", timeout=120)

    privkey, pubkey = None, None

    while True:
        i = child.expect([
            "Y/N:",
            "Aethir>",
            "Current private key:",
            "Current public key:",
            pexpect.EOF,
            pexpect.TIMEOUT
        ])
        if i == 0:  # Terms of service
            child.sendline("y")
        elif i == 1:  # CLI prompt
            child.sendline("aethir wallet create")
        elif i == 2:  # Private key block
            privkey = child.readline().strip()
        elif i == 3:  # Public key
            pubkey = child.readline().strip()
        elif i == 4:  # EOF
            break
        elif i == 5:  # Timeout
            print("Timeout waiting for CLI output.")
            break

    return privkey, pubkey

def save_wallet(privkey, pubkey):
    print("[3/3] Saving wallet.json ...")
    if not privkey or not pubkey:
        raise RuntimeError("Failed to capture keys from CLI output.")

    data = {
        "private_key": privkey,
        "public_key": pubkey
    }

    with open(JSON_PATH, "w") as f:
        json.dump(data, f, indent=2)

    print(f"Keys saved to {JSON_PATH}")

def main():
    if os.path.exists(JSON_PATH):
        print(f"{JSON_PATH} already exists. Delete it first if you want a new wallet.")
        return

    run_install()
    privkey, pubkey = automate_cli()
    save_wallet(privkey, pubkey)

if __name__ == "__main__":
    main()
