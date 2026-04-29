# Running dedicated server on Linux

### Prerequisites

Warning: Run everything here within a tmux session if you'd like it to continue running once you log out of ssh

Ensure the following dependencies are installed on your host:

* podman
* tmux
* git
* text editor (e.g. vim)

### Podman Setup

On the machine that will host the dedicated server, execute the following commands individually:

```sh
mkdir -p $HOME/Games/dungeon-blitz-typescript
git clone https://github.com/minesa-org/dungeon-blitz-typescript $HOME/Games/dungeon-blitz-typescript
cd $HOME/Games/dungeon-blitz-typescript/Container
podman build --no-cache -t dungeon-blitz-typescript:latest .
```

### Running the Container

Run the container with:

```sh
podman run --replace -it \
  --name dungeon-blitz-typescript \
  --network=host \
  -v $HOME/Games:/opt/games \
  dungeon-blitz-typescript:latest
```

Type exit once it gets into a shell.

Start the container by running

```sh
podman start -ai dungeon-blitz-typescript
```

To start your server, run:
```sh
entrypoint.sh
```
