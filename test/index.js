var should      = require('chai').should(),
    synchronise = require('../index'),
    component   = synchronise.Component,
    workflow    = synchronise.Workflow;

describe('component', function() {
    it('run', function() {
        component.run("componentName", {}, {
            success: function(data){
                data.should.equal("ok");
            },
            error: function(data){
                data.should.equal("error");
            },
            progress: function(data){
                data.should.equal("progress");
            }
        });
    });
});
