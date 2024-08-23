# PIX Portal Library

PIX Portal Library is a Python library that provides common functionality for PIX applications. Currently, only PIX workers use this library to query PIX services for assets, files, projects, and users.

## Usage

When a new change is implemented in the library, we go through the following steps:

- updating the library's version;
- building the library;
- updating dependent applications to use the newest version of the library;
- copying the packaged library wheel-file into dependent applications;
- installing the new library into a Python environment.

Most of the steps are implemented in `build_and_update.sh`. Here's an example of how to use it:

- Update the library's version in `pyproject.toml` or simply run `poetry version patch|minor|major`

  ```shell
  poetry version patch # or "minor", or "major"
  ```

- Update the version in dependent packages (this string `pix-portal-lib = { path = "lib/pix_portal_lib-0.1.58-py3-none-any.whl" }` in `pyproject.toml`)

- Run the script that copies the library and triggers the update of dependent packages:

  ```shell
  ./build_and_update.sh
  ```
