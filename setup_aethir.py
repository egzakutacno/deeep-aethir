#!/usr/bin/env python3
"""
Aethir Checker Docker Setup Script
Based on the working approach from aethir_setup.py
"""

import subprocess
import os
import sys

def run_cmd(cmd, check=True):
    print(f"\n$ {cmd}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print(result.stderr)
    if check and result.returncode != 0:
        raise Exception(f"Command failed: {cmd}")
    return result

def main():
    container_name = input("Enter container name (e.g., aethir-checker): ").strip()
    if not container_name:
        container_name = "aethir-checker"

    print(f"🚀 Setting up Aethir Checker in container: {container_name}")

    # Step 1: Build the base image
    print("\n📦 Building base systemd image...")
    run_cmd("docker build -t aethir-checker-base:latest .")

    # Step 2: Run the container
    print(f"\n🐳 Starting container: {container_name}")
    docker_run_cmd = f"""docker run --privileged --cgroupns=host \
        --name {container_name} \
        -v /sys/fs/cgroup:/sys/fs/cgroup \
        --tmpfs /run --tmpfs /run/lock --tmpfs /tmp --tmpfs /var/log/journal \
        -d aethir-checker-base:latest"""
    run_cmd(docker_run_cmd)

    # Step 3: Copy the tar.gz file into the container
    tar_file = "files/AethirCheckerCLI-linux-1.0.3.2.tar.gz"
    if not os.path.exists(tar_file):
        print(f"❌ File not found: {tar_file}")
        print("Please ensure the Aethir Checker CLI tarball is in the files/ directory")
        return

    print(f"\n📁 Copying {tar_file} to container...")
    docker_cp_cmd = f"docker cp {tar_file} {container_name}:/root/"
    run_cmd(docker_cp_cmd)

    # Step 4: Extract and install inside the container
    print("\n⚙️ Installing Aethir Checker CLI...")
    commands_inside = (
        "cd /root && "
        "tar -xzvf AethirCheckerCLI-linux-1.0.3.2.tar.gz && "
        "cd AethirCheckerCLI-linux && "
        "./install.sh"
    )
    docker_exec_cmd = f"docker exec {container_name} bash -c '{commands_inside}'"
    run_cmd(docker_exec_cmd)

    # Step 5: Verify installation
    print("\n✅ Verifying installation...")
    run_cmd(f"docker exec {container_name} ls -la /usr/local/bin/aethir*")
    run_cmd(f"docker exec {container_name} systemctl status")

    # Step 6: Start the Aethir service
    print("\n🚀 Starting Aethir Checker service...")
    run_cmd(f"docker exec {container_name} systemctl start aethir-checker")
    run_cmd(f"docker exec {container_name} systemctl status aethir-checker")

    print(f"\n🎉 Setup complete! Container: {container_name}")
    print("\nTo access the container:")
    print(f"  docker exec -it {container_name} bash")
    print("\nTo check service status:")
    print(f"  docker exec {container_name} systemctl status aethir-checker")

    # Ask if user wants to enter the container
    enter_container = input("\nEnter container now? (y/n): ").strip().lower()
    if enter_container in ['y', 'yes']:
        print(f"\n🐚 Entering container: {container_name}")
        os.system(f"docker exec -it {container_name} bash")

if __name__ == "__main__":
    main()
