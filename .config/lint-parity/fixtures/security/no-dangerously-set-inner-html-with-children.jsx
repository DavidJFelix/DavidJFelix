function createMarkup() {
    return { __html: 'child' }
}
<Component dangerouslySetInnerHTML={createMarkup()}>"child1"</Component>
