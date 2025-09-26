#!/usr/bin/env python3
"""
Aethir CLI Automation using Typer
Replaces expect-based automation with a more reliable Python approach
"""

import typer
import subprocess
import json
import os
import time
import sys
from pathlib import Path
from typing import Optional, Dict, Any

app = typer.Typer(help="Aethir CLI Automation Tool")

# Configuration
AETHIR_CLI_PATH = "/root/AethirCheckerCLI-linux/AethirCheckerCLI"
WALLET_JSON_PATH = "/root/wallet.json"
INSTALL_SCRIPT_PATH = "/root/AethirCheckerCLI-linux/install.sh"

class AethirCLI:
    """Wrapper class for Aethir CLI interactions"""
    
    def __init__(self, cli_path: str = AETHIR_CLI_PATH):
        self.cli_path = cli_path
        self.process = None
        
    def run_command(self, command: str, timeout: int = 60) -> subprocess.CompletedProcess:
        """Run a single Aethir CLI command"""
        try:
            # Use subprocess.run with input for interactive commands
            result = subprocess.run(
                [self.cli_path],
                input=command,
                text=True,
                capture_output=True,
                timeout=timeout
            )
            return result
        except subprocess.TimeoutExpired:
            typer.echo(f"❌ Command timed out after {timeout} seconds", err=True)
            raise
        except Exception as e:
            typer.echo(f"❌ Error running command: {e}", err=True)
            raise
    
    def interactive_session(self, commands: list[str]) -> Dict[str, str]:
        """Run multiple commands in an interactive session"""
        try:
            # Start the CLI process
            self.process = subprocess.Popen(
                [self.cli_path],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            # Send commands sequentially
            for i, command in enumerate(commands):
                typer.echo(f"📤 Sending command {i+1}: {command}")
                self.process.stdin.write(command + "\n")
                self.process.stdin.flush()
                time.sleep(2)  # Give CLI time to process
            
            # Close stdin and get output
            self.process.stdin.close()
            stdout, stderr = self.process.communicate(timeout=60)
            
            return {
                "stdout": stdout,
                "stderr": stderr,
                "returncode": self.process.returncode
            }
            
        except Exception as e:
            typer.echo(f"❌ Interactive session error: {e}", err=True)
            raise
        finally:
            if self.process:
                self.process.terminate()

@app.command()
def install() -> None:
    """Run the Aethir installation script"""
    typer.echo("🔧 Running Aethir installation...")
    
    if not os.path.exists(INSTALL_SCRIPT_PATH):
        typer.echo(f"❌ Install script not found at {INSTALL_SCRIPT_PATH}", err=True)
        raise typer.Exit(1)
    
    try:
        result = subprocess.run(
            ["bash", INSTALL_SCRIPT_PATH],
            capture_output=True,
            text=True,
            check=True
        )
        typer.echo("✅ Installation completed successfully")
        if result.stdout:
            typer.echo(result.stdout)
    except subprocess.CalledProcessError as e:
        typer.echo(f"❌ Installation failed: {e}", err=True)
        if e.stderr:
            typer.echo(f"Error output: {e.stderr}", err=True)
        raise typer.Exit(1)

@app.command()
def create_wallet() -> None:
    """Create a new Aethir wallet and save keys to JSON"""
    typer.echo("🔑 Creating Aethir wallet...")
    
    if not os.path.exists(AETHIR_CLI_PATH):
        typer.echo(f"❌ Aethir CLI not found at {AETHIR_CLI_PATH}", err=True)
        typer.echo("Run 'install' command first", err=True)
        raise typer.Exit(1)
    
    # Check if wallet already exists
    if os.path.exists(WALLET_JSON_PATH):
        typer.echo(f"⚠️  Wallet already exists at {WALLET_JSON_PATH}")
        if typer.confirm("Do you want to create a new wallet?"):
            os.remove(WALLET_JSON_PATH)
        else:
            typer.echo("Keeping existing wallet")
            return
    
    try:
        cli = AethirCLI()
        
        # Commands to run in sequence
        commands = [
            "y",  # Accept TOS
            "aethir wallet create",  # Create wallet
            "aethir wallet export",  # Export keys
            "exit"  # Exit CLI
        ]
        
        typer.echo("🚀 Starting interactive session...")
        result = cli.interactive_session(commands)
        
        if result["returncode"] != 0:
            typer.echo(f"❌ CLI exited with code {result['returncode']}", err=True)
            if result["stderr"]:
                typer.echo(f"Error: {result['stderr']}", err=True)
            raise typer.Exit(1)
        
        # Parse the output to extract keys
        wallet_data = parse_wallet_output(result["stdout"])
        
        if wallet_data:
            save_wallet_json(wallet_data)
            typer.echo("✅ Wallet created and saved successfully!")
        else:
            typer.echo("❌ Failed to extract wallet keys from output", err=True)
            typer.echo(f"CLI Output:\n{result['stdout']}", err=True)
            raise typer.Exit(1)
            
    except Exception as e:
        typer.echo(f"❌ Wallet creation failed: {e}", err=True)
        raise typer.Exit(1)

@app.command()
def status() -> None:
    """Check the status of Aethir CLI and wallet"""
    typer.echo("📊 Aethir Status Check")
    
    # Check CLI binary
    if os.path.exists(AETHIR_CLI_PATH):
        typer.echo("✅ Aethir CLI binary found")
    else:
        typer.echo("❌ Aethir CLI binary not found")
    
    # Check wallet
    if os.path.exists(WALLET_JSON_PATH):
        typer.echo("✅ Wallet file found")
        try:
            with open(WALLET_JSON_PATH, 'r') as f:
                wallet_data = json.load(f)
                if wallet_data.get("private_key") and wallet_data.get("public_key"):
                    typer.echo("✅ Wallet contains valid keys")
                else:
                    typer.echo("⚠️  Wallet file exists but keys are missing")
        except json.JSONDecodeError:
            typer.echo("❌ Wallet file is corrupted")
    else:
        typer.echo("❌ Wallet file not found")

@app.command()
def show_wallet() -> None:
    """Display wallet information"""
    if not os.path.exists(WALLET_JSON_PATH):
        typer.echo("❌ No wallet found. Run 'create-wallet' first.", err=True)
        raise typer.Exit(1)
    
    try:
        with open(WALLET_JSON_PATH, 'r') as f:
            wallet_data = json.load(f)
        
        typer.echo("🔑 Wallet Information:")
        typer.echo(f"Private Key: {wallet_data.get('private_key', 'Not found')}")
        typer.echo(f"Public Key: {wallet_data.get('public_key', 'Not found')}")
        
    except json.JSONDecodeError:
        typer.echo("❌ Wallet file is corrupted", err=True)
        raise typer.Exit(1)

def parse_wallet_output(output: str) -> Optional[Dict[str, str]]:
    """Parse wallet keys from CLI output"""
    try:
        lines = output.split('\n')
        private_key = None
        public_key = None
        
        for i, line in enumerate(lines):
            if "Current private key:" in line:
                # Look for the key in the next few lines
                for j in range(i+1, min(i+10, len(lines))):
                    key_line = lines[j].strip()
                    if key_line and not key_line.startswith("Current"):
                        private_key = key_line
                        break
            
            elif "Current public key:" in line:
                # Public key is usually on the same line or next line
                if ":" in line:
                    public_key = line.split(":")[1].strip()
                elif i+1 < len(lines):
                    public_key = lines[i+1].strip()
        
        if private_key and public_key:
            return {
                "private_key": private_key,
                "public_key": public_key
            }
        
        return None
        
    except Exception as e:
        typer.echo(f"❌ Error parsing wallet output: {e}", err=True)
        return None

def save_wallet_json(wallet_data: Dict[str, str]) -> None:
    """Save wallet data to JSON file"""
    try:
        with open(WALLET_JSON_PATH, 'w') as f:
            json.dump(wallet_data, f, indent=2)
    except Exception as e:
        typer.echo(f"❌ Error saving wallet: {e}", err=True)
        raise

@app.command()
def automate() -> None:
    """Full automation: install + create wallet"""
    typer.echo("🚀 Starting full Aethir automation...")
    
    try:
        # Step 1: Install
        install()
        
        # Step 2: Create wallet
        create_wallet()
        
        typer.echo("🎉 Automation completed successfully!")
        
    except typer.Exit:
        raise
    except Exception as e:
        typer.echo(f"❌ Automation failed: {e}", err=True)
        raise typer.Exit(1)

if __name__ == "__main__":
    app()
