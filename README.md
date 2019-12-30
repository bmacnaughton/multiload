# multiload
Framework for executing actions against a web server.

This is a work-in-progress with the specific goal of generating different transaction loads against a bmacnaughton/todo server.

It's not very general now but making it so is a longer-term goal.

multiload.js is the main program. it is the only real documentation of the options and overall structure at this point.

action.js is the base class that actions inherit from. each action file located in `actions/` defines an action that multiload can execute.

todos:
- move ui parsing and help to get-cli-options module.
- remove delete action; replace with delete-all action.
- add action-specific help


errata:

does not handle incorrect ws-ip at all.
