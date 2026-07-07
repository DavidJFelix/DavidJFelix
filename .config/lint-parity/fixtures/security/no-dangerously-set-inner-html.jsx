function createMarkup() {
    return { __html: 'child' }
}
<div dangerouslySetInnerHTML={createMarkup()}></div>
