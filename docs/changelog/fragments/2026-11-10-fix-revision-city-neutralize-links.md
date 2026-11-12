### fix(revision.city): show the address of links in posted model text

The reviewer cleans mentions, issue references, HTML, and suggestions out of the model text that it
posts. Markdown links and images went through as they were. So a pull request's author could steer
the model to show an image, or a link whose text hides where it goes, under the app's name. The
cleaner now puts a zero-width space after the `]` of `](` and `]:`. A link or an image then shows as
its Markdown source, and its address stays a plain link that shows its host. Bare addresses do not
change.
