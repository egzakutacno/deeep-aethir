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
        """Run multiple commands in an interactive session with proper prompt waiting"""
        import threading
        import queue
        
        try:
            # Start the CLI process
            self.process = subprocess.Popen(
                [self.cli_path],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=0  # Unbuffered
            )
            
            # Queue for collecting output
            output_queue = queue.Queue()
            all_output = []
            
            def read_output():
                """Read stdout in a separate thread with full debugging"""
                try:
                    while True:
                        line = self.process.stdout.readline()
                        if not line:
                            break
                        all_output.append(line)
                        output_queue.put(line)
                        # Debug: Show every line from CLI in real-time
                        typer.echo(f"🔍 CLI OUTPUT: {repr(line)}")
                except Exception as e:
                    typer.echo(f"🔍 READ ERROR: {e}")
                    pass
            
            # Start reading thread
            reader_thread = threading.Thread(target=read_output)
            reader_thread.daemon = True
            reader_thread.start()
            
            # Send commands with proper timing based on actual CLI flow
            typer.echo("🚀 Starting interactive session...")
            
            for i, command in enumerate(commands):
                typer.echo(f"📤 Sending command {i+1}: {command}")
                self.process.stdin.write(command + "\n")
                self.process.stdin.flush()
                
                if command == "y":
                    # Wait for TOS acceptance, "Client is starting up...", "Initializing...", and instructions
                    typer.echo("⏳ Waiting for TOS acceptance, CLI startup, initialization, and Aethir> prompt...")
                    time.sleep(10)  # Need more time for full initialization
                    
                elif "wallet create" in command:
                    # Wait for wallet creation, keys display, and next Aethir> prompt
                    typer.echo("⏳ Waiting for wallet creation and keys display...")
                    time.sleep(5)
                    
                elif "wallet export" in command:
                    # Wait for export completion and keys display
                    typer.echo("⏳ Waiting for wallet export completion...")
                    time.sleep(3)
                    
                elif "aethir exit" in command:
                    # Wait for CLI to exit properly
                    typer.echo("⏳ Waiting for CLI to exit...")
                    time.sleep(2)
            
            # Close stdin after sending all commands
            self.process.stdin.close()
            
            # Wait for process to complete (since we sent aethir exit)
            typer.echo("⏳ Waiting for CLI to exit completely...")
            try:
                self.process.wait(timeout=10)
                typer.echo("✅ CLI exited successfully")
            except subprocess.TimeoutExpired:
                typer.echo("⚠️ CLI didn't exit in time, but that's OK")
                time.sleep(2)  # Give a moment for final output
            
            # Join the reader thread
            typer.echo("⏳ Joining reader thread...")
            reader_thread.join(timeout=5)
            
            # Get stderr
            stderr = self.process.stderr.read()
            if stderr:
                typer.echo(f"🔍 STDERR: {repr(stderr)}")
            
            stdout_text = "".join(all_output)
            typer.echo(f"🔍 Total stdout length: {len(stdout_text)}")
            typer.echo(f"🔍 Total lines captured: {len(all_output)}")
            
            # Since we're letting the process continue running, return success
            typer.echo(f"✅ Interaction completed successfully (CLI still running)")
            
            return {
                "stdout": stdout_text,
                "stderr": stderr,
                "returncode": 0  # Success since we got the keys
            }
            
        except subprocess.TimeoutExpired:
            typer.echo("⚠️ Process timed out, terminating...")
            self.process.kill()
            return {
                "stdout": "".join(all_output),
                "stderr": "Process timed out",
                "returncode": -1
            }
        except Exception as e:
            typer.echo(f"❌ Interactive session error: {e}", err=True)
            raise
        finally:
            if self.process and self.process.poll() is None:
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
            "aethir exit"  # Properly exit the CLI
        ]
        
        typer.echo("🚀 Starting interactive session...")
        result = cli.interactive_session(commands)
        
        if result["returncode"] != 0:
            typer.echo(f"❌ CLI exited with code {result['returncode']}", err=True)
            if result["stderr"]:
                typer.echo(f"Error: {result['stderr']}", err=True)
            raise typer.Exit(1)
        
        # Debug: Show the raw output
        typer.echo(f"🔍 CLI stdout length: {len(result['stdout'])}")
        typer.echo(f"🔍 CLI stderr: {result['stderr']}")
        
        # Parse the output to extract keys
        wallet_data = parse_wallet_output(result["stdout"])
        
        if wallet_data:
            save_wallet_json(wallet_data)
            typer.echo("✅ Wallet created and saved successfully!")
        else:
            typer.echo("❌ Failed to extract wallet keys from output", err=True)
            typer.echo(f"🔍 CLI Output (first 500 chars):\n{result['stdout'][:500]}", err=True)
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
def debug_cli() -> None:
    """Debug: Test CLI interaction manually with full output"""
    typer.echo("🔍 Debug: Testing CLI interaction...")
    
    if not os.path.exists(AETHIR_CLI_PATH):
        typer.echo(f"❌ Aethir CLI not found at {AETHIR_CLI_PATH}", err=True)
        raise typer.Exit(1)
    
    try:
        typer.echo("🚀 Starting CLI process...")
        process = subprocess.Popen(
            [AETHIR_CLI_PATH],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        typer.echo("📤 Sending 'y' to accept TOS...")
        process.stdin.write("y\n")
        process.stdin.flush()
        
        typer.echo("⏳ Waiting 15 seconds for CLI initialization...")
        time.sleep(15)
        
        typer.echo("📤 Sending 'aethir wallet create'...")
        process.stdin.write("aethir wallet create\n")
        process.stdin.flush()
        
        typer.echo("⏳ Waiting 10 seconds for wallet creation...")
        time.sleep(10)
        
        typer.echo("📤 Sending 'aethir wallet export'...")
        process.stdin.write("aethir wallet export\n")
        process.stdin.flush()
        
        typer.echo("⏳ Waiting 5 seconds for export...")
        time.sleep(5)
        
        typer.echo("📤 Sending 'exit'...")
        process.stdin.write("exit\n")
        process.stdin.close()
        
        typer.echo("⏳ Waiting for process to complete...")
        stdout, stderr = process.communicate(timeout=30)
        
        typer.echo("🔍 RAW CLI OUTPUT:")
        typer.echo("=" * 50)
        typer.echo(repr(stdout))
        typer.echo("=" * 50)
        
        if stderr:
            typer.echo("🔍 RAW CLI STDERR:")
            typer.echo(repr(stderr))
        
        typer.echo(f"✅ CLI process completed with return code: {process.returncode}")
        
    except Exception as e:
        typer.echo(f"❌ Debug failed: {e}", err=True)
        raise typer.Exit(1)

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
    """Parse wallet keys from CLI output based on actual format"""
    try:
        lines = output.split('\n')
        private_key = None
        public_key = None
        
        # Look for keys in the entire output (both create and export sections)
        for i, line in enumerate(lines):
            if "Current private key:" in line:
                # Look for the base64 key in the next few lines
                for j in range(i+1, min(i+15, len(lines))):
                    key_line = lines[j].strip()
                    if key_line and len(key_line) > 50 and not key_line.startswith("Current") and not key_line.startswith("***************************************"):
                        private_key = key_line
                        typer.echo(f"🔍 Found private key: {key_line[:50]}...")
                        break
            
            elif "Current public key:" in line:
                # Look for the hex key in the next few lines
                for j in range(i+1, min(i+5, len(lines))):
                    key_line = lines[j].strip()
                    if key_line and len(key_line) == 40 and not key_line.startswith("Current") and not key_line.startswith("***************************************"):
                        public_key = key_line
                        typer.echo(f"🔍 Found public key: {key_line}")
                        break
        
        typer.echo(f"🔍 Parsed private key: {'Found' if private_key else 'Not found'}")
        typer.echo(f"🔍 Parsed public key: {'Found' if public_key else 'Not found'}")
        
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
